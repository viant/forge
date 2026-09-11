// DataSource.jsx
import React, {useEffect, useState} from "react";
import {getLogger} from "../utils/logger.js";
import {useSignals} from '@preact/signals-react/runtime';
import { extractData, isDeferredCacheHitEnvelope } from "./dataSourceExtract.js";
import { beginDataSourceFetch, consumeDataSourceFetchRequest, reconcileRestoredPendingFetch, recoverInterruptedFetchOnMount, resolveFetchPage, shouldReplayPendingFetchOnMount, snapshotFilter, withFetchedPageInfo } from "./dataSourceFetchState.js";
import {reconcileMultiSelection, reconcileSingleSelection} from "./dataSourceSelection.js";
import {applyFetchTransform} from "./dataSourceTransform.js";
import {hasResolvedDependencies} from "./dataSourceDependencies.js";
import {bindingFinalizationAction, isCurrentBindingGeneration} from "./primitives/bindingGeneration.js";
import {resourceModelRefForDataSource, unmarshalResourceCollection} from "./primitives/resourceModel.js";
import {settleDataSourceRequest} from './dataSourceRequestLifecycle.js';
import {shouldDispatchSelectionEvent} from './selectionEventModel.js';
import {reconcileFetchForMetadataReadiness} from './dataSourceMetadataReadiness.js';
import {
    findSelectionSignal,

} from "../core/index.js";

import {
    dataSourceEvents,
} from "../hooks/index.js";

import {useRef} from "react";


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
    const upstream = dataSource.dataSourceRef
        ? findSelectionSignal(identity.getDataSourceId(dataSource.dataSourceRef))
        : null;

    const handleUpstream = () => {
        try {
            if (upstream.value.selected) {
                let {records} = extractData(selectors, paging, upstream.value.selected);

                records = unmarshalResourceCollection(records, context, resourceModelRef);
                records = applyFetchTransform(events, records);
                const currentCollection = Array.isArray(collection.peek()) ? collection.peek() : [];
                const currentSelection = selection.peek() || {};
                const nextSelected = dataSource.autoSelect === false
                    ? null
                    : (records?.length > 0 ? records[0] : null);
                const nextRowIndex = nextSelected ? 0 : -1;
                const collectionChanged = stableSnapshotSignature(currentCollection) !== stableSnapshotSignature(records);
                const selectionChanged = (
                    Number(currentSelection?.rowIndex ?? -1) !== nextRowIndex
                    || safeUniqueKey(getUniqueKeyValue, currentSelection?.selected) !== safeUniqueKey(getUniqueKeyValue, nextSelected)
                );
                if (collectionChanged) {
                    collection.value = records;
                }

                // ----------------------------------------------------------
                // Auto-selection behaviour
                // If dataSource.autoSelect === false we leave every row
                // unselected; otherwise (default) keep the legacy behaviour
                // of picking the first record.
                // ----------------------------------------------------------
                if (selectionChanged) {
                    if (dataSource.autoSelect === false) {
                        setSelected({selected: null, rowIndex: -1});
                    } else {
                        setSelected({selected: nextSelected, rowIndex: nextRowIndex});
                    }
                }
            } else {
                const currentCollection = Array.isArray(collection.peek()) ? collection.peek() : [];
                const currentSelection = selection.peek() || {};
                if (currentCollection.length > 0) {
                    collection.value = [];
                }
                if (
                    Number(currentSelection?.rowIndex ?? -1) !== -1
                    || currentSelection?.selected != null
                ) {
                    setSelected({selected: null, rowIndex: -1})
                }
            }
        } catch (err) {
            if ((Array.isArray(collection.peek()) ? collection.peek() : []).length > 0) {
                collection.value = [];
            }
            const currentSelection = selection.peek() || {};
            if (
                Number(currentSelection?.rowIndex ?? -1) !== -1
                || currentSelection?.selected != null
            ) {
                setSelected({selected: null, rowIndex: -1})
            }
            setError(err);
        } finally {
            flagReadDone();
        }
    }


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
                handleUpstream()
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
            handleUpstream()
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
        };
    }


    async function refreshRecords() {
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
            if (!mountedRef.current) return;
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
            if (!mountedRef.current) return;
            setError(err);
            try {
                if (events.onError && events.onError.isDefined()) {
                    log.debug('[refreshRecords] onError:execute', {ds: context?.identity?.dataSourceRef});
                    events.onError.execute({error: err});
                }
            } catch (_) {
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }


    /**
     * doFetchRecords
     *  - Merges child filter with collectDependencies
     *  - Calls connector.getRecords
     *  - Then calls postFetchHook
     */
    async function doFetchRecords() {
        try {
            log.debug('[doFetchRecords] start', {ds: context?.identity?.dataSourceRef, ts: Date.now()});
        } catch (_) {
        }
        const inputVal = input.value || {};
        let {page, filter = {}, parameters, sort = [], cache = null, invocationId = null, bindingGeneration = null} = inputVal || {};
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
        const requestSig = JSON.stringify({filter, parameters, page, sort});
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
            prevFilterRef.current = snapshotFilter(filter);

            // 2) Merge into filter
            const finalFilter = {...filter};
            const currentSelection = {...selection.peek()};

            // 3) Perform GET
            const payload = await connector.get({
                filter: finalFilter,
                page,
                inputParameters: {...(parameters || {}), ...(sort?.length ? {sort} : {})},
                cache,
                invocationId,
            });
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

            let {records, info, stats} = extractData(selectors, paging, payload);
            const deferredCacheHit = isDeferredCacheHitEnvelope(payload);
            if (deferredCacheHit && records.length === 0) {
                const previousRecords = Array.isArray(collection.peek()) ? collection.peek() : [];
                if (previousRecords.length > 0) {
                    records = previousRecords;
                    info = collectionInfo.peek() || info;
                    stats = metrics.peek() || stats;
                }
            }
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
            collection.value = records;
            try {
                log.debug('[doFetchRecords] set collection', {
                    ds: context?.identity?.dataSourceRef,
                    size: Array.isArray(records) ? records.length : 0
                });
            } catch (_) {
            }
            collectionInfo.value = withFetchedPageInfo(info, page, pagingEnabled, {
                returnedCount: records.length,
                pageSize: paging?.size,
                openEnded: paging?.openEnded === true,
            });
            metrics.value = stats;
            control.value = { ...control.peek(), loaded: true, error: null, stale: false };
            if (selectionMode === 'multi') {
                const reconciledSelection = reconcileMultiSelection(currentSelection, records, getUniqueKeyValue);
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
            if (!mountedRef.current) {
                settleDataSourceRequest(requestDataSourceId, requestId, err);
                return;
            }
            settleDataSourceRequest(requestDataSourceId, requestId, err);
            if (!isCurrentBindingGeneration(input.peek()?.bindingGeneration, bindingGeneration)) {
                try { log.debug('[doFetchRecords] ignored stale binding error', {ds: context?.identity?.dataSourceRef, bindingGeneration}); } catch (_) {}
                return;
            }
            log.warn('doFetchRecords error', err)
            setError(err);

            // Fire DS-level onError if defined
            try {
                if (events.onError && events.onError.isDefined()) {
                    log.debug('[doFetchRecords] onError:execute', {ds: context?.identity?.dataSourceRef});
                    events.onError.execute({error: err});
                }
            } catch (_) {
            }
        } finally {
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
