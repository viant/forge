import {useDataSourceHandlers} from "../../hooks";
import {
    getCollectionSignal,
    getControlSignal,
    getCollectionInfoSignal,
    getInputSignal,
    getSelectionSignal,
    getMetricsSignal,
    getMessageSignal,
    getFormStatusSignal,
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
    // ------------------------------------------------------------------
    // Inject default global services when not supplied
    // ------------------------------------------------------------------
    if (!services) services = {};

    // Ensure form.updateItemProperties exists
    if (!services.form) services.form = {};
    if (typeof services.form.updateItemProperties !== 'function') {
        services.form.updateItemProperties = (props = {}) => {
            const { args = [], context, item, value } = props;
            // bump control signal for the referenced control -> triggers re-eval of onProperties
            try {
                const targetId = args[0];
                if (targetId) {
                    const ctlSignal = context?.signals?.control;
                    if (ctlSignal) {
                        const snapshot = ctlSignal.peek();
                        ctlSignal.value = { ...snapshot, [targetId]: Date.now() };
                    }
                }
            } catch (e) {
                console.error('form.updateItemProperties bump error', e);
            }

            return true; // allow default handler to proceed
        };
    }
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
        resources: {},
        metadata: metadata,
        dataSourceRef: dataSourceRef,
        _globalServices: services || {},
        services,
        handlers: {
            window: windowHandlers,
            ...(services || {}),
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
            result.lookupHandler = (name) => {
                return resolveActionHandler(result.actions, result.handlers, name);
            }
            dialogContextCache[key] = result
            return dialogContextCache[key]
        },

        lookupHandler:function (name)  {
            return resolveActionHandler(this.actions, this.handlers, name)
        },

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
            const selectionSignals = hasSelection ? {
                collection: getCollectionSignal(identity.dataSourceId),
                collectionInfo: getCollectionInfoSignal(identity.dataSourceId),
                selection: getSelectionSignal(identity.dataSourceId, initialSelectionValue),
                metrics: getMetricsSignal(identity.dataSourceId),
                formStatus: getFormStatusSignal(identity.dataSourceId),
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
                handlers: {
                    ...this._globalServices,
                },
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
                ...this._globalServices,
            }
            result.actions = metadata.actions.import(result) || {}

            result.lookupHandler = (name) => {
                return resolveActionHandler(result.actions, result.handlers, name);
            }
            dataSourceContextCache[dataSourceRef] = result
            this.dataSources[dataSourceRef] = dataSourceContextCache[dataSourceRef];
            return dataSourceContextCache[dataSourceRef];
        }


    };
};