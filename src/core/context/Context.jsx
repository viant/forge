import {useDataSourceHandlers} from "../../hooks";
import {
    getCollectionSignal,
    getControlSignal,
    getCollectionInfoSignal,
    getInputSignal,
    getSelectionSignal,
    getMetricsSignal,
    getMessageSignal,
    getFormSignal
} from "../store/signals.js";


import {resolveHandler} from "../../actions";
import {useDialogHandlers, useWindowHandlers} from "../../hooks";
import useDataConnector from "../../hooks/dataconnector";

function resolveActionHandler(actions, handlers, name) {
    if (!actions) return null;
    const keys = name.split(".");
    let result = actions;
    for (const key of keys) {
        if (!key || typeof result[key] === "undefined") {
            return resolveHandler(handlers, name);
        }
        result = result[key];
    }
    if (typeof result !== "function") {
        return resolveHandler(handlers, name);
    }
    return result;
}


export const Context = (windowId, metadata, dataSourceRef, services) => {
    const dataSourceContextCache = {};
    const dialogContextCache = {}
    const signalIds = {}
    const windowControlSignal = getControlSignal(windowId);
    const windowHandlers = useWindowHandlers(windowId);


    const getDataSourceId = (dataSourceRef) => {
        return `${windowId}DS${dataSourceRef}`
    }

    const getDialogId = (dialogId) => {
        return `${windowId}Dialog${dialogId}`
    }


    const {ns} = metadata || [];
    return {
        identity: {windowId, getDataSourceId, dataSourceRef, getDialogId},
        metadata: metadata,
        dataSourceRef: dataSourceRef,
        services,
        handlers: {
            window: windowHandlers,
        },
        actions: {},
        dialogs: {},
        dataSources: {},
        view: metadata.view,

        init: function () {
            const actions = this.metadata.actions.import(this)
            this.actions = actions
        },

        dialogContext: function (dialog, dataSourceRef) {
            const key = getDialogId(dialog.id)
            if (dialogContextCache[key]) {
                return dialogContextCache[key]
            }
            const ctx = this.Context(dataSourceRef)
            const result = {...ctx, handlers: {...ctx.handlers, dialog: useDialogHandlers(windowId, dialog.id)}}
            result.lookupHandler = (name) => resolveActionHandler(result.actions, result.handlers, name);
            dialogContextCache[key] = result
            return dialogContextCache[key]
        },

        lookupHandler: (name) => resolveActionHandler(this.actions, this.handlers, name),

        Context: function (dataSourceRef) {
            if (!dataSourceRef) {
                dataSourceRef = this.identity.dataSourceRef
            }

            let result = dataSourceContextCache[dataSourceRef]
            if (result) {
                return result
            }

            const identity = {
                ...this.identity,
                dataSourceRef,
                ns,
                dataSourceId: getDataSourceId(dataSourceRef)
            }
            const dataSource = metadata.dataSource[dataSourceRef]
            if (!dataSource) {
                throw new Error(`DataSource not found: ${dataSourceRef}`, identity)
            }

            const initialSelectionValue =
                dataSource.selectionMode === 'multi' ? {selection: []} : {selected: null, rowIndex: -1};
            const hasSelection = dataSource.selectionMode !== 'none'

            console.log('ds:', identity.dataSourceRef, hasSelection)

            const selectionSignals = hasSelection ? {
                collection: getCollectionSignal(identity.dataSourceId),
                collectionInfo: getCollectionInfoSignal(identity.dataSourceId),
                selection: getSelectionSignal(identity.dataSourceId, initialSelectionValue),
                metrics: getMetricsSignal(identity.dataSourceId),
            } : {}

            const standardSignals = {
                input: getInputSignal(identity.dataSourceId),
                form: getFormSignal(identity.dataSourceId),
                control: getControlSignal(identity.dataSourceId),
                message: getMessageSignal(identity.dataSourceId),
                windowControl: windowControlSignal
            }


            const signals = {
                ...standardSignals,
                ...selectionSignals
            }


            const connector = useDataConnector(dataSource);
            result = {
                ...this,
                handlers: {},
                identity,
                connector,
                signals,
                dataSource: metadata.dataSource[dataSourceRef],
                itemId: (container, item) => {
                    return `${windowId}DS${dataSourceRef}.(${container.id}||'').${item.id}`
                },
                getSignalId: (key) => {
                    this.signalIds[key] = true
                    return `${windowId}DS${dataSourceRef}Signal${key}`
                },
                tableSettingKey:(key) => {
                    return `${windowId}DS${dataSourceRef}Table${key}`
                }

            };
            result.handlers = {
                dataSource: useDataSourceHandlers(identity, signals, metadata.dataSource, connector),
                window: windowHandlers,
            }
            result.actions = metadata.actions.import(result) || {}
            result.lookupHandler = (name) => resolveActionHandler(result.actions, result.handlers, name);
            dataSourceContextCache[dataSourceRef] = result
            this.dataSources[dataSourceRef] = dataSourceContextCache[dataSourceRef];
            return dataSourceContextCache[dataSourceRef];
        }


    };
};