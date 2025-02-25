// DataSource.jsx
import React, {useState} from "react";
import {useSignalEffect} from "@preact/signals-react";
import {isMapEquals} from "../utils";
import {
    getSelectionSignal,

} from "../core";

import {
    dataSourceEvents,
} from "../hooks";



/**
 * hasResolvedDependencies
 *  - Returns true if all defined parameters can be resolved from their locations.
 *  - If at least one parameter is missing, returns false.
 */
function hasResolvedDependencies(parameters = [], values = {}) {
    if (!parameters || parameters?.length === 0) return true; // no parameters => no dependencies
    for (const paramDef of parameters) {
        const isDefined = (paramDef.name in values) && values[paramDef.name] !== undefined;
        if (!isDefined) {
            return false;
        }
    }
    return true;
}


/**
 * Resolve a dot-separated ley
 */
export const resolveKey = (holder, name) => {
    const keys = name.split(".");
    if (keys.length === 1) {
        return holder[name]
    }
    let result = holder;
    for (const key of keys) {
        if (!key || typeof result[key] === "undefined") {
            const reportAvailableKeys = []
            for (const key in result) {
                reportAvailableKeys.push(key)
            }
            throw new Error(`key "${key}" not found in holder, avails: "${reportAvailableKeys}".`, result);
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
        records = resolveKey(data, dataSelector) || [];
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
    let prevFilter = {};

    const {dataSource, signals, connector, handlers, identity} = context
    const {paging, selectors} = dataSource;
    const {input, collection, selection, collectionInfo, metrics, form} = signals
    const {getUniqueKeyValue, setSelected, setLoading, setError, setInactive} = handlers.dataSource
    const events = dataSourceEvents(context, dataSource);
    const upstream = dataSource.dataSourceRef ? getSelectionSignal(identity.getDataSourceId(dataSource.dataSourceRef)) : null;


    const handleUpstream = () => {
        if (upstream.value.selected) {
            console.log('upstream', upstream.value.selected)
            let {records} = extractData(selectors, paging, upstream.value.selected);
            console.log('upstream records', records)

            if (events.onFetch.isDefined() && records.length > 0) {
                records = events.onFetch.execute({collection: records})
            }
            console.log('upstream after fetch records', records)

            collection.value = records;
            const selected = records?.length > 0 ? records[0] : null;
            const rowIndex = selected ? 0 : -1;
            setSelected({selected: selected, rowIndex: rowIndex})
        } else {
            collection.value = [];
            setSelected({selected: null, rowIndex: -1})
        }
        flagReadDone();
    }


// Watch for input.fetch or input.refresh
    useSignalEffect(() => {
        const inputVal = input.value || {};
        const {fetch, refresh = false} = inputVal;
        if (!fetch && ! refresh) return;
        if (refresh) {
            if (dataSource.dataSourceRef) {
                handleUpstream()
                return
            }

            return refreshRecords().finally(() => {
                flagReadDone();
            });
        }
        if (dataSource.dataSourceRef) {
            handleUpstream()
            return
        }

        return doFetchRecords().finally(() => {
            input.peek().fetch = false;
        });
    });


    function flagReadDone() {
        input.peek().fetch = false;
        input.peek().refresh = false;
    }


    async function refreshRecords() {
        const inputVal = input.value || {};
        let {refreshFilter, parameters} = inputVal || {};
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters)

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
                                snapshot[i] = { ...snapshot[i], ...newRecord };
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
                    collection.value = snapshot
                    if (selectedIndex >= 0) {
                        setSelected({selected: records[0], rowIndex: selectedIndex})
                    }
                }
            }
        } catch
            (err) {
            setError(err);
            collection.value = [];
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
        const inputVal = input.value || {};
        let {page, filter, parameters} = inputVal || {};
        const hasDeps = hasResolvedDependencies(dataSource.parameters, parameters)

        if (!hasDeps) {
            setSelected({selected: null, rowIndex: -1})
            collection.value = [];
            flagReadDone()
            setInactive(true);
            return;
        } else {
            setInactive(false);
        }


        if (paging) {
            page = page || 1
            inputVal[page] = page
        }
        setLoading(true);
        try {
            // 1) gather dependency data
            // const depObj = collectDependencies(dataSourceId, context, dataSources);
            //  ...depObj

            if (!isMapEquals(filter, prevFilter)) {
                page = 1;
            }
            prevFilter = {...filter};

            // 2) Merge into filter
            const finalFilter = {...filter};
            const currentSelection = {...selection.peek()}

            // collectionInfo.value = {};
            setSelected({selected: null, rowIndex: -1})
            collection.value = [];

            // 3) Perform GET
            const payload = await connector.get({
                filter: finalFilter,
                page,
                inputParameters: parameters,
            });
            let {records, info, stats} = extractData(selectors, paging, payload);
            if (events.onFetch.isDefined() && records.length > 0) {
                records = events.onFetch.execute({collection: records})
            }

            collection.value = records;
            collectionInfo.value = info;
            metrics.value = stats;

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
        } catch (err) {
            console.warn('doFetchRecords error', err)
            setError(err);
            collection.value = [];

        } finally {
            setLoading(false);
        }
    }


    return null; // invisible
}
