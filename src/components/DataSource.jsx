// DataSource.jsx
import React, {useEffect, useState} from "react";
import {getLogger} from "../utils/logger.js";
import {useSignals} from '@preact/signals-react/runtime';
import { extractData, isDeferredCacheHitEnvelope } from "./dataSourceExtract.js";
import {collectPagedCollection} from "./pagedCollectionAggregate.js";
import { beginDataSourceFetch, consumeDataSourceFetchRequest, reconcileRestoredPendingFetch, recoverInterruptedFetchOnMount, resolveFetchPage, shouldReplayPendingFetchOnMount, snapshotFilter, suppressRepeatedFailedFetch, withFetchedPageInfo, snapshotFetchedPageResult } from "./dataSourceFetchState.js";
import {pageSelectionPolicy, reconcileMultiSelection, reconcileSingleSelection} from "./dataSourceSelection.js";
import {applyFetchTransform} from "./dataSourceTransform.js";
import {hasResolvedDependencies} from "./dataSourceDependencies.js";
import {bindingFinalizationAction, isCurrentBindingGeneration} from "./primitives/bindingGeneration.js";
import {resourceModelRefForDataSource, unmarshalResourceCollection} from "./primitives/resourceModel.js";
import {settleDataSourceRequest} from './dataSourceRequestLifecycle.js';
import {isProtectedUpstreamDenial, isDataSourceLocalDenial} from './dataSourceAuthorization.js';
import {shouldDispatchSelectionEvent} from './selectionEventModel.js';
import {reconcileFetchForMetadataReadiness} from './dataSourceMetadataReadiness.js';
import {
    findSelectionSignal,
    protectedWindowEpoch,
    protectedDataSourceEpoch,
    clearDeniedDataSourceState,
    denyProtectedWindow,

} from "../core/index.js";

import {
    dataSourceEvents,
} from "../hooks/index.js";

import {useRef} from "react";
import {createCursorPagingSession, cursorPagingAssociation, markCompletedCursorAssociation, withPagingSize} from "../hooks/paging.js";


export {hasResolvedDependencies};


// Helper function to get a node by nodePath in a tree structure
function getNodeByPath(nodes, path, selfReference) {
    let node = null;
    let children = nodes;

    for (const index of path) {
        node = children[index];
        if (!node) {
            return null;
        }
        children = node[selfReference] || [];
    }
    return node;
}

function safeUniqueKey(getUniqueKeyValue, value) {
    try {
        const resolved = getUniqueKeyValue(value);
        return resolved == null ? '' : String(resolved);
    } catch (_) {
        return '';
    }
}

function stableSnapshotSignature(value) {
    try {
        return JSON.stringify(value ?? null);
    } catch (_) {
        return '';
    }
}

/**
 * DataSource props:
 *  - context
 */
export default function DataSource({context}) {
    useSignals();
    const log = getLogger('ds');
    try { log.debug('[mount]', { ds: context?.identity?.dataSourceRef }); } catch (_) {}
    const prevFilterRef = useRef({});
    const selectionPageRef = useRef(null);
    const cursorSessionRef = useRef(null);
    const prevQuerySig = useRef('');
    const lastResolvedParametersRef = useRef({});
    const mountedRef = useRef(true);
    const initialFetchObservationRef = useRef(true);

    const {dataSource, signals, connector, handlers, identity} = context
    const {paging, selectors} = dataSource;
    const pagingEnabled = !!paging?.enabled;
    const {input, collection, selection, collectionInfo, metrics, form, control} = signals
    const {getUniqueKeyValue, setSelected, setLoading, setError, setInactive} = handlers.dataSource
    const events = dataSourceEvents(context, dataSource);
    const notifyFetchError = (error, phase) => {
        try {
            if (events.onError && events.onError.isDefined()) {
                log.debug(`[${phase}] onError:execute`, {ds: context?.identity?.dataSourceRef});
                events.onError.execute({error});
            }
        } catch (_) {
        }
    };
    const resourceModelRef = resourceModelRefForDataSource(context, dataSource.resourceModelRef);
    const selectionMode = dataSource.selectionMode || 'single';
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    // Ensure the upstream selection signal is always initialised with an
    // object so that downstream code can safely access `.selected` without
    // additional null-checks.
    const upstreamRef = dataSource.dataSourceRef;
    const upstreamContext = upstreamRef && context.metadata?.dataSource?.[upstreamRef]
        ? context.Context?.(upstreamRef) : null;
    const upstream = upstreamContext?.signals?.selection || (upstreamRef
        ? findSelectionSignal(identity.getDataSourceId(upstreamRef)) : null);
    const upstreamSnapshot = upstream?.value;
    const upstreamControl = upstreamContext?.signals?.control?.value;
    const projectionRef = useRef(null);
    const cloneProjection = value => value == null ? value
        : typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

    const handleUpstream = () => {
        const requestId = input.peek()?.bindingGeneration || input.peek()?.invocationId;
        const parentControl = upstreamContext?.signals?.control?.peek?.() || {};
        if (parentControl.loading || (parentControl.stale && !parentControl.error) || (!upstream?.peek?.()?.selected && !parentControl.loaded && !parentControl.error && !parentControl.inactive)) {
            if (!control.peek()?.loading) setLoading(true);
            return;
        }
        try {
            if (parentControl.error) throw parentControl.error;
            const payload = cloneProjection(upstream?.peek?.()?.selected);
            let {records, info, stats} = payload
                ? extractData(selectors, paging, payload)
                : {records: [], info: {}, stats: {}};
            records = unmarshalResourceCollection(records, context, resourceModelRef);
            records = applyFetchTransform(events, records);
            const currentCollection = Array.isArray(collection.peek()) ? collection.peek() : [];
            const currentSelection = selection.peek() || {};
            const parentIdentity = safeUniqueKey(upstreamContext?.handlers?.dataSource?.getUniqueKeyValue, payload);
            const parentChanged = projectionRef.current?.parentIdentity != null && projectionRef.current.parentIdentity !== parentIdentity;
            const selectedKey = safeUniqueKey(getUniqueKeyValue, currentSelection.selected);
            const retainedIndex = !parentChanged && currentSelection.selected
                ? records.findIndex(row => safeUniqueKey(getUniqueKeyValue, row) === selectedKey) : -1;
            const nextRowIndex = dataSource.autoSelect === false ? retainedIndex : (records.length ? 0 : -1);
            const nextSelected = nextRowIndex >= 0 ? records[nextRowIndex] : null;
            const signature = stableSnapshotSignature(records);
            const collectionChanged = stableSnapshotSignature(currentCollection) !== signature;
            const selectionChanged = parentChanged || Number(currentSelection.rowIndex ?? -1) !== nextRowIndex
                || safeUniqueKey(getUniqueKeyValue, currentSelection.selected) !== safeUniqueKey(getUniqueKeyValue, nextSelected);
            // Only the initiating successful save can accept normalized values.
            // Edits made after submission and drafts in sibling views survive.
            const synchronization = input.peek()?.formSynchronization;
            const acceptSavedForm = !selectionChanged && synchronization
                && stableSnapshotSignature(form.peek()) === stableSnapshotSignature(synchronization.expectedForm);
            const keepDraft = !selectionChanged && !acceptSavedForm && signals.formStatus?.peek?.()?.dirty === true;
            const draft = keepDraft ? cloneProjection(form.peek()) : null;
            if (collectionChanged) collection.value = records;
            if (stableSnapshotSignature(metrics.peek()) !== stableSnapshotSignature(stats)) metrics.value = stats;
            if (stableSnapshotSignature(collectionInfo.peek()) !== stableSnapshotSignature(info)) collectionInfo.value = info;
            if (selectionChanged || collectionChanged || acceptSavedForm) {
                setSelected({selected: nextSelected, rowIndex: nextRowIndex});
                // Advance the baseline while retaining another tab's draft.
                if (keepDraft) handlers.dataSource.setEditedFormData({values: draft});
            }
            const previous = control.peek() || {};
            if (previous.loaded !== !parentControl.inactive || previous.loading || previous.error || previous.inactive !== !!parentControl.inactive) {
                control.value = {...previous, loaded: !parentControl.inactive, loading: false, error: null, inactive: !!parentControl.inactive};
            }
            const notify = !parentControl.inactive && (projectionRef.current?.signature !== signature || projectionRef.current?.error || projectionRef.current?.inactive);
            projectionRef.current = {signature, parentIdentity, inactive: !!parentControl.inactive};
            flagReadDone();
            if (notify && events.onSuccess?.isDefined?.()) events.onSuccess.execute({collection: records, payload});
            settleDataSourceRequest(identity.dataSourceId, requestId, null, records);
        } catch (err) {
            const retainDraft = signals.formStatus?.peek?.()?.dirty === true
                && !isDataSourceLocalDenial(err, context) && !isProtectedUpstreamDenial(context, err);
            if (!retainDraft) {
                if ((collection.peek() || []).length) collection.value = [];
                if (selection.peek()?.selected || Number(selection.peek()?.rowIndex ?? -1) !== -1) setSelected({selected: null, rowIndex: -1});
            }
            const previous = control.peek() || {};
            if (previous.error !== err || previous.loading || previous.loaded) control.value = {...previous, loaded: false, loading: false, error: err};
            if (projectionRef.current?.error !== err) notifyFetchError(err, "projection");
            projectionRef.current = {...projectionRef.current, error: err};
            flagReadDone();
            settleDataSourceRequest(identity.dataSourceId, requestId, err);
        }
    };
    useEffect(() => {
        if (upstream) handleUpstream();
    }, [upstreamSnapshot, upstreamControl]);

    const fetchUpstream = cache => {
        if (cache?.bypassCache === true && upstreamContext?.handlers?.dataSource?.fetchCollection) {
            if (!control.peek()?.loading) setLoading(true);
            const completion = upstreamContext.handlers.dataSource.fetchCollection({cache, sharedRead: true});
            // Parent signal updates own propagation. Consume an optional rejected
            // completion here; its error also reaches every dependent context.
            completion?.catch?.(() => {});
        } else handleUpstream();
    };

    const inputValue = input.value || {};
    const controlValue = control.value || {};

    // Log input signal changes to help diagnose missing fetch triggers
    useEffect(() => {
        try {
            log.debug('[input changed]', { ds: context?.identity?.dataSourceRef, input: inputValue });
        } catch (_) {}
    }, [context?.identity?.dataSourceRef, inputValue, log]);

    // Watch for input.fetch or input.refresh
    useEffect(() => {
        const inputVal = inputValue || {};
        const {fetch, refresh = false} = inputVal;
        const loadingNow = !!(controlValue || {}).loading;
        const initialFetchObservation = initialFetchObservationRef.current;
        initialFetchObservationRef.current = false;
        try { log.debug('[watch] flags', { ds: context?.identity?.dataSourceRef, fetch, refresh, loading: loadingNow, input: inputVal }); } catch(_) {}
        const deferredForMetadata = reconcileFetchForMetadataReadiness(context, inputVal, controlValue);
        if (deferredForMetadata) {
            input.value = deferredForMetadata.input;
            if (deferredForMetadata.control !== controlValue) control.value = deferredForMetadata.control;
            try { log.debug('[watch] suppress fetch until current target metadata is ready', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            return;
        }
        const restored = reconcileRestoredPendingFetch(dataSource, inputVal, controlValue);
        if (restored) {
            input.value = restored.input;
            if (restored.control !== controlValue) control.value = restored.control;
            try { log.debug('[watch] reconcile restored pending fetch', { ds: context?.identity?.dataSourceRef, replay: restored.input.fetch }); } catch(_) {}
            return;
        }
        const recovered = recoverInterruptedFetchOnMount(dataSource, inputVal, controlValue, initialFetchObservation);
        if (recovered) {
            input.value = recovered.input;
            control.value = recovered.control;
            try { log.debug('[watch] recovered interrupted mount fetch', { ds: context?.identity?.dataSourceRef, replay: recovered.input.fetch }); } catch(_) {}
            return;
        }
        if (!fetch && !refresh) {
            try { log.debug('[watch] skip (no flags)', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            return;
        }
        if (initialFetchObservation && fetch && !shouldReplayPendingFetchOnMount(dataSource, fetch)) {
            input.value = {
                ...input.peek(),
                fetch: false,
                refresh: false,
            };
            try { log.debug('[watch] suppress restored pending fetch', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            return;
        }
        if (loadingNow) {
            try { log.debug('[watch] defer (loading)', { ds: context?.identity?.dataSourceRef, fetch, refresh }); } catch(_) {}
            return;
        }

        if (refresh) {
            const consumed = consumeDataSourceFetchRequest(input.peek(), "refresh");
            if (!consumed) return;
            input.value = consumed;
            if (dataSource.dataSourceRef) {
                try { log.debug('[watch] refresh: upstream branch', { ds: context?.identity?.dataSourceRef, upstream: dataSource.dataSourceRef }); } catch(_) {}
                fetchUpstream(inputVal.cache)
                return
            }
            try { log.debug('[watch] refresh: direct branch', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            void refreshRecords().finally(() => {
                flagReadDone();
            });
            return;
        }
        if (dataSource.dataSourceRef) {
            const consumed = consumeDataSourceFetchRequest(input.peek(), "fetch");
            if (!consumed) return;
            input.value = consumed;
            try { log.debug('[watch] fetch: upstream branch', { ds: context?.identity?.dataSourceRef, upstream: dataSource.dataSourceRef }); } catch(_) {}
            fetchUpstream(inputVal.cache)
            return
        }

        try { log.debug('[watch] fetch: direct branch', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        const consumed = consumeDataSourceFetchRequest(input.peek(), "fetch");
        if (!consumed) return;
        input.value = consumed;
        void doFetchRecords().finally(() => {
            try { log.debug('[watch] fetch flag consumed', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        });
        return;
    }, [context?.identity?.dataSourceRef, inputValue, controlValue, dataSource, log]);

    // Fire onSelection (alias onItemSelect) when DS selection changes
    const prevSelectionKey = useRef('');
    useEffect(() => {
        try {
            const sel = selection.value || {};
            let key = 'none';
            if (dataSource.selfReference) {
                if (selectionMode === 'multi') {
                    const arr = (sel.selection || []).map(it => (it?.nodePath || []).join('/'));
                    key = `m:${arr.join('|')}`;
                } else {
                    key = `s:${(sel.nodePath || []).join('/')}`;
                }
            } else {
                if (selectionMode === 'multi') {
                    const arr = (sel.selection || []).map(rec => {
                        try { return String(getUniqueKeyValue(rec)); } catch(_) { return ''; }
                    });
                    key = `m:${arr.join('|')}`;
                } else {
                    const uid = sel && sel.selected ? (() => { try { return String(getUniqueKeyValue(sel.selected)); } catch(_) { return ''; } })() : '';
                    key = `s:${uid}#${sel.rowIndex ?? -1}`;
                }
            }
            if (key === prevSelectionKey.current) {
                return;
            }
            prevSelectionKey.current = key;

            // Only fire when there is a meaningful selection
            const hasMeaningfulSelection = shouldDispatchSelectionEvent(selectionMode, sel, {selfReference: dataSource.selfReference});
            if (!hasMeaningfulSelection) return;

            // Execute custom selection handlers if present
            if (events.onItemSelect && events.onItemSelect.isDefined()) {
                if (selectionMode === 'multi') {
                    events.onItemSelect.execute({ selection: sel.selection || [] });
                } else if (dataSource.selfReference) {
                    events.onItemSelect.execute({ selected: sel.selected || null, nodePath: sel.nodePath || null });
                } else {
                    events.onItemSelect.execute({ selected: sel.selected || null, rowIndex: sel.rowIndex ?? -1 });
                }
            }
        } catch (_) { /* ignore */ }
    }, [selection.value, selectionMode, dataSource.selfReference, events, getUniqueKeyValue]);


    function flagReadDone() {
        input.value = {
            ...input.peek(),
            fetch: false,
            refresh: false,
            invocationId: null,
            formSynchronization: null,
        };
    }


    async function refreshRecords() {
        const authorizationEpoch = protectedWindowEpoch(identity?.windowId);
        const datasetEpoch = protectedDataSourceEpoch(identity?.dataSourceId);
        const authorizationIsCurrent = () => protectedWindowEpoch(identity?.windowId) === authorizationEpoch && protectedDataSourceEpoch(identity?.dataSourceId) === datasetEpoch;
        const inputVal = input.value || {};
        let {refreshFilter, parameters} = inputVal || {};
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters, refreshFilter, dataSource.requiredAnyParameters)
        if (!hasDeps) {
            const preservedParameters = lastResolvedParametersRef.current || {};
            if (dataSource?.preserveParametersOnMissingDependencies === true && Object.keys(preservedParameters).length > 0) {
                input.value = {
                    ...input.peek(),
                    parameters: {
                        ...((input.peek() || {}).parameters || {}),
                        ...preservedParameters,
                    },
                    fetch: false,
                    refresh: false,
                };
                setInactive(false);
            } else {
                flagReadDone()
                setInactive(true);
            }
            setLoading(false);
            return;
        } else {
            setInactive(false);
            lastResolvedParametersRef.current = { ...(parameters || {}) };
        }


        const finalFilter = {...refreshFilter};
        control.value = beginDataSourceFetch(control.peek());
        setLoading(true);
        try {
            const payload = await connector.get({
                filter: finalFilter
            })
            if (!mountedRef.current || !authorizationIsCurrent()) return;
            control.value = {...control.peek(), loaded: true, error: null, stale: false};


            let {records} = extractData(selectors, paging, payload);

            records = unmarshalResourceCollection(records, context, resourceModelRef);
            records = applyFetchTransform(events, records);

            if (records.length > 0) {
                const uid = getUniqueKeyValue(records[0]);
                let selectedIndex = selection.peek()?.rowIndex || -1
                const snapshot = collection.peek()
                if (selectedIndex >= 0 && selectedIndex < snapshot.length) {
                    if (getUniqueKeyValue(snapshot[selectedIndex]) !== uid) {
                        selectedIndex = -1
                    }
                }


                // Updated code: recursively match and update the record
                function updateRecordInSnapshot(snapshot, uid, newRecord) {
                    for (let i = 0; i < snapshot.length; i++) {


                        if (getUniqueKeyValue(snapshot[i]) === uid) {
                            if (dataSource.selfReference) {
                                snapshot[i] = {...snapshot[i], ...newRecord};
                            } else {
                                snapshot[i] = newRecord;
                            }
                            return true;
                        }
                        if (dataSource.selfReference && snapshot[i][dataSource.selfReference]) {
                            const updatedChild = updateRecordInSnapshot(
                                snapshot[i][dataSource.selfReference],
                                uid,
                                newRecord
                            );
                            if (updatedChild) {
                                return true;
                            }
                        }
                    }
                    return false;
                }

                const updated = updateRecordInSnapshot(snapshot, uid, records[0]);
                if (updated) {
                    collection.value = [...snapshot]
                    if (selectedIndex >= 0) {
                        setSelected({selected: records[0], rowIndex: selectedIndex})
                    }
                }
            }

            // Fire DS-level onSuccess if defined
            try {
                if (events.onSuccess && events.onSuccess.isDefined()) {
                    log.debug('[refreshRecords] onSuccess:execute', {ds: context?.identity?.dataSourceRef});
                    events.onSuccess.execute({
                        collection: Array.isArray(collection.peek()) ? collection.peek() : [],
                        payload
                    });
                }
            } catch (_) {
            }
        } catch (err) {
            if (!mountedRef.current || !authorizationIsCurrent()) return;
            if (isDataSourceLocalDenial(err, context)) {
                clearDeniedDataSourceState(identity.dataSourceId, err);
                notifyFetchError(err, 'refreshRecords');
                return;
            }
            if (isProtectedUpstreamDenial(context, err)) {
                denyProtectedWindow(identity.windowId, Number(err.status));
                return;
            }
            setError(err);
            notifyFetchError(err, 'refreshRecords');
        } finally {
            if (mountedRef.current && authorizationIsCurrent()) setLoading(false);
        }
    }


    /**
     * doFetchRecords
     *  - Merges child filter with collectDependencies
     *  - Calls connector.getRecords
     *  - Then calls postFetchHook
     */
    async function doFetchRecords() {
        const authorizationEpoch = protectedWindowEpoch(identity?.windowId);
        const datasetEpoch = protectedDataSourceEpoch(identity?.dataSourceId);
        const authorizationIsCurrent = () => protectedWindowEpoch(identity?.windowId) === authorizationEpoch && protectedDataSourceEpoch(identity?.dataSourceId) === datasetEpoch;
        try {
            log.debug('[doFetchRecords] start', {ds: context?.identity?.dataSourceRef, ts: Date.now()});
        } catch (_) {
        }
        const inputVal = input.value || {};
        let {page, filter = {}, parameters, sort = [], cache = null, invocationId = null, bindingGeneration = null} = inputVal || {};
        const requestPaging = withPagingSize(paging, inputVal.pageSize);
        const requestId = bindingGeneration || invocationId;
        const requestDataSourceId = context?.identity?.dataSourceId;
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters, filter, dataSource.requiredAnyParameters);
        if (!hasDeps) {
            const preservedParameters = lastResolvedParametersRef.current || {};
            if (dataSource?.preserveParametersOnMissingDependencies === true && Object.keys(preservedParameters).length > 0) {
                input.value = {
                    ...input.peek(),
                    parameters: {
                        ...((input.peek() || {}).parameters || {}),
                        ...preservedParameters,
                    },
                    fetch: false,
                    refresh: false,
                };
                setInactive(false);
            } else {
                settleDataSourceRequest(requestDataSourceId, requestId, new Error('Datasource dependencies are not resolved.'));
                setSelected({selected: null, rowIndex: -1});
                collection.value = [];
                flagReadDone();
                setInactive(true);
            }
            setLoading(false);
            return;
        }
        setInactive(false);
        lastResolvedParametersRef.current = { ...(parameters || {}) };

        // ------------------------------------------------------------------
        // Compute the request signature (captures everything that influences
        // the result). If unchanged, we keep existing collection; otherwise
        // we optimistically clear.
        // ------------------------------------------------------------------
        const requestSig = JSON.stringify({filter, parameters, page, pageSize: requestPaging?.size, sort});
        const previousFailure = control.peek() || {};
        if (suppressRepeatedFailedFetch(previousFailure, requestSig, cache)) {
            flagReadDone();
            setLoading(false);
            settleDataSourceRequest(requestDataSourceId, requestId, previousFailure.error);
            return;
        }
        // const queryChanged = requestSig !== prevQuerySig.current;
        // if (queryChanged) {
        //     setSelected({selected: null, rowIndex: -1});
        //     collection.value = [];
        // } else {
        //     // No meaningful change → skip network call
        //     return Promise.resolve();
        // }

        if (pagingEnabled) {
            page = page || 1;
        }

        control.value = beginDataSourceFetch(control.peek());
        setLoading(true);
        try {
            page = resolveFetchPage({
                page,
                filter,
                previousFilter: prevFilterRef.current,
                pagingEnabled,
            });
            const cursorMode = pagingEnabled && String(paging?.mode || '').trim().toLowerCase() === 'cursor';
            if (cursorMode && !cursorSessionRef.current) cursorSessionRef.current = createCursorPagingSession();
            if (!cursorMode) cursorSessionRef.current = null;
            const cursorRequest = cursorMode ? cursorSessionRef.current.begin(page, cursorPagingAssociation(context, {filter, parameters, sort})) : null;
            if (cursorRequest) page = cursorRequest.page;
            prevFilterRef.current = snapshotFilter(filter);

            // 2) Merge into filter
            const finalFilter = {...filter};
            const currentSelection = {...selection.peek()};

            // 3) Perform GET
            const aggregate = requestPaging?.aggregate === true;
            if (aggregate && (!pagingEnabled || cursorMode)) {
                throw new Error('Aggregated paging requires bounded page or offset requests.');
            }
            const fetchPage = requestedPage => connector.get({
                filter: finalFilter,
                page: requestedPage,
                pageSize: requestPaging?.size,
                ...(cursorRequest ? {cursor: cursorRequest.cursor} : {}),
                inputParameters: {...(parameters || {}), ...(sort?.length ? {sort} : {})},
                cache,
                invocationId,
            });
            const collected = aggregate ? await collectPagedCollection({
                pageSize: Number(requestPaging.size),
                maxPages: Number(requestPaging.maxPages),
                fetchPage,
                extractPage: payload => extractData(selectors, requestPaging, payload),
                keyForRow: getUniqueKeyValue,
                shouldContinue: () => authorizationIsCurrent() && mountedRef.current
                    && isCurrentBindingGeneration(input.peek()?.bindingGeneration, bindingGeneration),
            }) : null;
            if (aggregate) page = 1;
            const payload = aggregate ? collected.payload : await fetchPage(page);
            if (!authorizationIsCurrent()) return;
            if (!mountedRef.current) {
                settleDataSourceRequest(requestDataSourceId, requestId, new Error('Datasource unmounted before request completion.'));
                return;
            }
            if (!isCurrentBindingGeneration(input.peek()?.bindingGeneration, bindingGeneration)) {
                settleDataSourceRequest(requestDataSourceId, requestId, null, payload);
                try { log.debug('[doFetchRecords] ignored stale binding generation', {ds: context?.identity?.dataSourceRef, bindingGeneration}); } catch (_) {}
                return;
            }
            try {
                log.debug('[doFetchRecords] response', {
                    ds: context?.identity?.dataSourceRef,
                    keys: payload ? Object.keys(payload) : [],
                    type: typeof payload
                });
            } catch (_) {
            }

            let {records, info, stats} = aggregate
                ? collected
                : extractData(selectors, requestPaging, payload);
            if (cursorRequest) {
                info = cursorSessionRef.current.finish(cursorRequest, info);
                if (!info) return;
            }
            const deferredCacheHit = !aggregate && isDeferredCacheHitEnvelope(payload);
            if (deferredCacheHit && records.length === 0) {
                const previousRecords = Array.isArray(collection.peek()) ? collection.peek() : [];
                if (previousRecords.length > 0) {
                    records = previousRecords;
                    info = collectionInfo.peek() || info;
                    stats = metrics.peek() || stats;
                }
            }
            const fetchedPageResult = snapshotFetchedPageResult(records, requestPaging);
            records = unmarshalResourceCollection(records, context, resourceModelRef);
            if (events.onFetch.isDefined()) {
                try {
                    log.debug('[doFetchRecords] onFetch:before', {
                        ds: context?.identity?.dataSourceRef,
                        size: records.length
                    });
                } catch (_) {
                }
                records = applyFetchTransform(events, records);
                try {
                    log.debug('[doFetchRecords] onFetch:after', {
                        ds: context?.identity?.dataSourceRef,
                        size: Array.isArray(records) ? records.length : 0
                    });
                } catch (_) {
                }
            }
            const previousPageRecords = collection.peek() || [];
            collection.value = records;
            try {
                log.debug('[doFetchRecords] set collection', {
                    ds: context?.identity?.dataSourceRef,
                    size: Array.isArray(records) ? records.length : 0
                });
            } catch (_) {
            }
            collectionInfo.value = aggregate ? info : cursorRequest ? markCompletedCursorAssociation({...info, returnedCount: records.length, pageSize: requestPaging?.size}, cursorRequest.signature) : withFetchedPageInfo(info, page, pagingEnabled, {
                ...fetchedPageResult,
                mode: paging?.mode,
                hasMoreSelector: paging?.dataInfoSelectors?.hasMore,
            });
            metrics.value = stats;
            control.value = { ...control.peek(), loaded: true, error: null, stale: false, failedRequestSignature: null };
            if (selectionMode === 'multi') {
                let reconciledSelection;
                if (dataSource.selectionRetention === 'pages') {
                    const policy = pageSelectionPolicy(prevQuerySig.current, requestSig);
                    const nextSelection = policy.clear ? {selection: []} : currentSelection;
                    reconciledSelection = reconcileMultiSelection(nextSelection, records, getUniqueKeyValue,
                        {retainMissing: policy.retainMissing});
                } else {
                    // Retain the existing opt-in's same-page refresh behavior:
                    // remove missing visible rows without losing off-page choices.
                    const selectionParameters = {...parameters};
                    for (const key of [paging?.parameters?.page, paging?.parameters?.size]) if (key) delete selectionParameters[key];
                    const scope = JSON.stringify({filter, parameters: selectionParameters, sort});
                    const previous = selectionPageRef.current;
                    const preserve = dataSource.selectionPreserveAcrossPages === true && pagingEnabled && previous?.scope === scope;
                    const scopedSelection = dataSource.selectionPreserveAcrossPages === true && previous && previous.scope !== scope ? {selection: []} : currentSelection;
                    reconciledSelection = reconcileMultiSelection(scopedSelection, records, getUniqueKeyValue,
                        {preserveOffPage: preserve, pageChanged: previous?.page !== page, previousRecords: previousPageRecords});
                    selectionPageRef.current = {scope, page};
                }
                if (stableSnapshotSignature(currentSelection?.selection) !== stableSnapshotSignature(reconciledSelection.selection)) {
                    setSelected(reconciledSelection);
                }
            } else if (selectionMode === 'single' && currentSelection?.selected) {
                const reconciledSelection = reconcileSingleSelection(currentSelection, records, getUniqueKeyValue);
                if (
                    Number(currentSelection?.rowIndex ?? -1) !== Number(reconciledSelection.rowIndex)
                    || stableSnapshotSignature(currentSelection?.selected) !== stableSnapshotSignature(reconciledSelection.selected)
                ) {
                    setSelected(reconciledSelection);
                }
            }
            if (pagingEnabled) {
                const currentInput = input.peek() || {};
                if (Number(currentInput.page || 1) !== Number(page || 1)) {
                    input.value = {
                        ...currentInput,
                        page,
                        fetch: false,
                        refresh: false,
                    };
                }
            }

            // Mark this signature as the latest successful fetch
            prevQuerySig.current = requestSig;

            if (currentSelection?.rowIndex >= 0) {
                const currentCollection = collection.peek()
                let selected = {rowIndex: -1, selected: null}
                if (currentCollection?.length > 0) {
                    let rowIndex = currentSelection.rowIndex
                    if (rowIndex >= currentCollection.length) {
                        rowIndex = currentCollection.length - 1
                    }
                    selected = {selected: currentCollection[rowIndex], rowIndex: rowIndex}
                    form.value = {...currentCollection[rowIndex]}
                }
                setSelected(selected)

            }
            // 4) Post-Fetch Hook
            else if (selectionMode !== 'multi' && dataSource.autoSelect !== false && records.length > 0) {
                // Nothing was selected previously – auto-select first row
                setSelected({selected: records[0], rowIndex: 0});
                form.value = {...records[0]};
            }

            // Fire DS-level onSuccess if defined
            try {
                if (events.onSuccess && events.onSuccess.isDefined()) {
                    log.debug('[doFetchRecords] onSuccess:execute', {ds: context?.identity?.dataSourceRef});
                    events.onSuccess.execute({
                        collection: Array.isArray(collection.peek()) ? collection.peek() : [],
                        payload
                    });
                }
            } catch (_) {
            }
            settleDataSourceRequest(requestDataSourceId, requestId, null, payload);
        } catch (err) {
            if (!authorizationIsCurrent()) return;
            if (!mountedRef.current) {
                settleDataSourceRequest(requestDataSourceId, requestId, err);
                return;
            }
            settleDataSourceRequest(requestDataSourceId, requestId, err);
            if (!isCurrentBindingGeneration(input.peek()?.bindingGeneration, bindingGeneration)) {
                try { log.debug('[doFetchRecords] ignored stale binding error', {ds: context?.identity?.dataSourceRef, bindingGeneration}); } catch (_) {}
                return;
            }
            if (isDataSourceLocalDenial(err, context)) {
                clearDeniedDataSourceState(identity.dataSourceId, err);
                notifyFetchError(err, 'doFetchRecords');
                return;
            }
            if (isProtectedUpstreamDenial(context, err)) {
                denyProtectedWindow(identity.windowId, Number(err.status));
                return;
            }
            log.warn('doFetchRecords error', err)
            setError(err);
            control.value = {...control.peek(), failedRequestSignature: requestSig};

            notifyFetchError(err, 'doFetchRecords');
        } finally {
            if (!authorizationIsCurrent()) return;
            const bindingIsCurrent = isCurrentBindingGeneration(input.peek()?.bindingGeneration, bindingGeneration);
            const nextInput = input.peek() || {};
            const finalization = bindingFinalizationAction(bindingIsCurrent, !!(nextInput.fetch || nextInput.refresh));
            if (mountedRef.current && (finalization === 'complete' || finalization === 'close')) setLoading(false);
            if (cache && mountedRef.current && finalization === 'complete') {
                input.value = {...input.peek(), cache: null};
            }
            if (mountedRef.current && finalization === 'continue') {
                input.value = {...nextInput, fetch: false, refresh: false};
                queueMicrotask(() => {
                    if (!mountedRef.current) return;
                    if (dataSource.dataSourceRef) handleUpstream();
                    else void doFetchRecords();
                });
            }
        }
    }


    return null; // invisible
}
