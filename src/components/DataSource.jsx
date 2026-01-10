// DataSource.jsx
import React, {useState} from "react";
import {getLogger} from "../utils/logger.js";
import {useSignalEffect} from "@preact/signals-react";
import {isMapEquals} from "../utils";
import {
    getSelectionSignal,

} from "../core";

import {
    dataSourceEvents,
} from "../hooks";

import {useRef} from "react";


/**
 * hasResolvedDependencies
 *  - Returns true if all defined parameters can be resolved from their locations.
 *  - If at least one parameter is missing, returns false.
 *  - If a parameter is missing but has a default value, the default is assigned.
 */
function hasResolvedDependencies(parameters = [], values = {}, filter = {}) {
    if (!parameters || parameters.length === 0) return true; // no parameters => no dependencies

    for (const paramDef of parameters) {
        if (paramDef?.from === 'const') {
            filter[paramDef.name] = paramDef.location;
            continue;
        }
        const isDefined = (paramDef.name in values) && values[paramDef.name] !== undefined;
        if (!isDefined) {
            if ('default' in paramDef) {
                values[paramDef.name] = paramDef.default;
            } else {
                return false;
            }
        }
    }
    return true;
}


/**
 * Resolve a dot-separated ley
 */
export const resolveKey = (holder, name) => {
    if (holder == null) return undefined;
    if (!name) return holder;
    const keys = name.split(".");
    if (keys.length === 1) {
        return holder[name]
    }
    let result = holder;
    for (const key of keys) {
        if (!key) {
            continue;
        }
        if (result == null || typeof result !== "object" || typeof result[key] === "undefined") {
            return undefined;
        }
        result = result[key]
    }
    return result;
};


function extractData(selectors, paging, data) {
    let records = []
    let info = {}
    let stats = {}
    // Extract data using dataSelector
    const dataSelector = selectors.data;
    if (!dataSelector) {
        records = data;
    } else {
        let respData = resolveKey(data, dataSelector)
        // Backward-compatible fallback: when selector cannot be resolved, treat the holder
        // itself as the payload so upstream data sources do not crash on schema drift.
        if (typeof respData === "undefined") {
            respData = data
        }
        if (respData && Array.isArray(respData)) {
            records = respData
        } else if (respData) {
            records = [respData]
        }
        const dataInfoSelector = selectors.dataInfo;
        if (dataInfoSelector && paging) {
            const {dataInfoSelectors} = paging
            const summary = data[dataInfoSelector] || {}
            info = {
                pageCount: summary[dataInfoSelectors.pageCount] || 0,
                totalCount: summary[dataInfoSelectors.totalCount] || 0
            }
            info.value = info || {};
        }
        const metricsSelector = selectors.metrics;
        if (metricsSelector) {
            stats = data[metricsSelector] || [];
        }
    }
    return {records, info, stats}
}


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


/**
 * DataSource props:
 *  - context
 */
export default function DataSource({context}) {
    const log = getLogger('ds');
    try { log.debug('[mount]', { ds: context?.identity?.dataSourceRef }); } catch (_) {}
    let prevFilter = {};
    const prevQuerySig = useRef('');

    const {dataSource, signals, connector, handlers, identity} = context
    const {paging, selectors} = dataSource;
    const {input, collection, selection, collectionInfo, metrics, form} = signals
    const {getUniqueKeyValue, setSelected, setLoading, setError, setInactive} = handlers.dataSource
    const events = dataSourceEvents(context, dataSource);
    const selectionMode = dataSource.selectionMode || 'single';
    // Ensure the upstream selection signal is always initialised with an
    // object so that downstream code can safely access `.selected` without
    // additional null-checks.
    const upstream = dataSource.dataSourceRef
        ? getSelectionSignal(
            identity.getDataSourceId(dataSource.dataSourceRef),
            {selected: null, rowIndex: -1},
        )
        : null;

    const handleUpstream = () => {
        try {
            if (upstream.value.selected) {
                let {records} = extractData(selectors, paging, upstream.value.selected);

                if (events.onFetch.isDefined() && records.length > 0) {
                    records = events.onFetch.execute({collection: records})
                }
                collection.value = records;

                // ----------------------------------------------------------
                // Auto-selection behaviour
                // If dataSource.autoSelect === false we leave every row
                // unselected; otherwise (default) keep the legacy behaviour
                // of picking the first record.
                // ----------------------------------------------------------
                if (dataSource.autoSelect === false) {
                    setSelected({selected: null, rowIndex: -1});
                } else {
                    const selected = records?.length > 0 ? records[0] : null;
                    const rowIndex = selected ? 0 : -1;
                    setSelected({selected, rowIndex});
                }
            } else {
                collection.value = [];
                setSelected({selected: null, rowIndex: -1})
            }
        } catch (err) {
            collection.value = [];
            setSelected({selected: null, rowIndex: -1})
            setError(err);
        } finally {
            flagReadDone();
        }
    }


    // Log input signal changes to help diagnose missing fetch triggers
    useSignalEffect(() => {
        try {
            const snap = input.value || {};
            log.debug('[input changed]', { ds: context?.identity?.dataSourceRef, input: snap });
        } catch (_) {}
    });

    // Watch for input.fetch or input.refresh
    useSignalEffect(() => {
        const inputVal = input.value || {};
        const {fetch, refresh = false} = inputVal;
        try { log.debug('[watch] flags', { ds: context?.identity?.dataSourceRef, fetch, refresh, input: inputVal }); } catch(_) {}
        if (!fetch && !refresh) {
            try { log.debug('[watch] skip (no flags)', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            return;
        }

        if (refresh) {
            if (dataSource.dataSourceRef) {
                try { log.debug('[watch] refresh: upstream branch', { ds: context?.identity?.dataSourceRef, upstream: dataSource.dataSourceRef }); } catch(_) {}
                handleUpstream()
                return
            }
            try { log.debug('[watch] refresh: direct branch', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
            return refreshRecords().finally(() => {
                flagReadDone();
            });
        }
        if (dataSource.dataSourceRef) {
            try { log.debug('[watch] fetch: upstream branch', { ds: context?.identity?.dataSourceRef, upstream: dataSource.dataSourceRef }); } catch(_) {}
            handleUpstream()
            return
        }

        try { log.debug('[watch] fetch: direct branch', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        return doFetchRecords().finally(() => {
            // Publish a new object so that the change propagates.
            input.value = {
                ...input.peek(),
                fetch: false,
            };
            try { log.debug('[watch] fetch flag cleared', { ds: context?.identity?.dataSourceRef }); } catch(_) {}
        });
    });

    // Fire onSelection (alias onItemSelect) when DS selection changes
    const prevSelectionKey = useRef('');
    useSignalEffect(() => {
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
            const hasMeaningfulSelection = (() => {
                if (selectionMode === 'multi') {
                    return Array.isArray(sel.selection) && sel.selection.length > 0;
                }
                if (dataSource.selfReference) {
                    return !!(sel && sel.selected && Array.isArray(sel.nodePath) && sel.nodePath.length > 0);
                }
                return !!(sel && sel.selected && (sel.rowIndex ?? -1) >= 0);
            })();
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
    });


    function flagReadDone() {
        input.value = {
            ...input.peek(),
            fetch: false,
            refresh: false,
        };
    }


    async function refreshRecords() {
        const inputVal = input.value || {};
        let {refreshFilter, parameters} = inputVal || {};
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters, refreshFilter)
        if (!hasDeps) {
            flagReadDone()
            setInactive(true);
            return;
        } else {
            setInactive(false);
        }


        const finalFilter = {...refreshFilter};
        setLoading(true);
        try {
            const payload = await connector.get({
                filter: finalFilter
            })


            let {records} = extractData(selectors, paging, payload);

            if (events.onFetch.isDefined() && records.length > 0) {
                records = events.onFetch.execute({collection: records})
            } 

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
            setError(err);
            try {
                if (events.onError && events.onError.isDefined()) {
                    log.debug('[refreshRecords] onError:execute', {ds: context?.identity?.dataSourceRef});
                    events.onError.execute({error: err});
                }
            } catch (_) {
            }
        } finally {
            setLoading(false);
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
        let {page, filter, parameters} = inputVal || {};
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters, filter);
        if (!hasDeps) {
            setSelected({selected: null, rowIndex: -1});
            collection.value = [];
            flagReadDone();
            setInactive(true);
            return;
        }

        // ------------------------------------------------------------------
        // Compute the request signature (captures everything that influences
        // the result). If unchanged, we keep existing collection; otherwise
        // we optimistically clear.
        // ------------------------------------------------------------------
        const requestSig = JSON.stringify({filter, parameters, page});
        // const queryChanged = requestSig !== prevQuerySig.current;
        // if (queryChanged) {
        //     setSelected({selected: null, rowIndex: -1});
        //     collection.value = [];
        // } else {
        //     // No meaningful change → skip network call
        //     return Promise.resolve();
        // }

        if (paging) {
            page = page || 1;
            inputVal[page] = page;
        }

        setLoading(true);
        try {
            // If filter changed, reset to first page
            if (!isMapEquals(filter, prevFilter)) {
                page = 1;
            }
            prevFilter = {...filter};

            // 2) Merge into filter
            const finalFilter = {...filter};
            const currentSelection = {...selection.peek()};

            // 3) Perform GET
            const payload = await connector.get({
                filter: finalFilter,
                page,
                inputParameters: parameters,
            });
            try {
                log.debug('[doFetchRecords] response', {
                    ds: context?.identity?.dataSourceRef,
                    keys: payload ? Object.keys(payload) : [],
                    type: typeof payload
                });
            } catch (_) {
            }

            let {records, info, stats} = extractData(selectors, paging, payload);
            if (events.onFetch.isDefined() && records.length > 0) {
                try {
                    log.debug('[doFetchRecords] onFetch:before', {
                        ds: context?.identity?.dataSourceRef,
                        size: records.length
                    });
                } catch (_) {
                }
                records = events.onFetch.execute({collection: records})
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
            collectionInfo.value = info;
            metrics.value = stats;

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
        } catch (err) {
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
            setLoading(false);
        }
    }


    return null; // invisible
}
