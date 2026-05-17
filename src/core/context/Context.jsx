import {useDataSourceHandlers} from "../../hooks";
import {
    getControlSignal,
    getCollectionInfoSignal,
    getCollectionSignal,
    getFormSignal,
    getFormStatusSignal,
    getInputSignal,
    getMessageSignal,
    getMetricsSignal,
    findControlSignal,
    getSelectionSignal,
} from "../store/signals.js";


import {resolveHandler} from "../../actions";
import {useDialogHandlers, useWindowHandlers} from "../../hooks";
import {createDataConnector} from "../../hooks/dataconnector";

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
            const {args = [], context, item, value} = props;
            // bump control signal for the referenced control -> triggers re-eval of onProperties
            try {
                const targetId = args[0];
                if (targetId) {
                    const ctlSignal = context?.signals?.control;
                    if (ctlSignal) {
                        const snapshot = ctlSignal.peek();
                        ctlSignal.value = {...snapshot, [targetId]: Date.now()};
                    }
                }
            } catch (e) {
                console.error('form.updateItemProperties bump error', e);
            }

            return true; // allow default handler to proceed
        };
    }
    const connectorRuntime = services?.__connectorRuntime || {};
    const dataSourceContextCache = {};
    const dialogContextCache = {}
    const signalIds = {}
    const windowControlSignal = findControlSignal(windowId);
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

        dialogContext: function (dialog, dataSourceRef, options = {}) {
            const selectionModeKey = String(options?.selectionMode || "").trim().toLowerCase();
            const key = `${getDialogId(dialog.id)}::${selectionModeKey || "default"}`
            if (dialogContextCache[key]) {
                return dialogContextCache[key]
            }
            // Build an isolated window context for the dialog and then create
            // a data-source scoped context so signals are available to handlers
            const base = Context(windowId, metadata, dataSourceRef, services)
            base.init();
            const dsCtx = base.Context(dataSourceRef, options);
            dsCtx.handlers = {...dsCtx.handlers, dialog: useDialogHandlers(windowId, dialog.id)};
            dsCtx.lookupHandler = (name) => resolveActionHandler(dsCtx.actions, dsCtx.handlers, name);
            dialogContextCache[key] = dsCtx
            return dialogContextCache[key]
        },

        lookupHandler: function (name) {
            return resolveActionHandler(this.actions, this.handlers, name)
        },

        Signals: function (dataSourceRef, hasSelection = false) {

            const identity = {
                ...this.identity,
                dataSourceRef,
                ns,
                dataSourceId: getDataSourceId(dataSourceRef)
            }
            const selectionSignals = hasSelection ? {
                collection: getCollectionSignal(identity.dataSourceId),
                collectionInfo: getCollectionInfoSignal(identity.dataSourceId),
                selection: getSelectionSignal(identity.dataSourceId, initialSelectionValue),
                metrics: getMetricsSignal(identity.dataSourceId),
            } : {}

            const standardSignals = {
                input: getInputSignal(identity.dataSourceId),
                form: getFormSignal(identity.dataSourceId),
                windowForm: getFormSignal(`${windowId}:windowForm`),
                control: getControlSignal(identity.dataSourceId),
                message: getMessageSignal(identity.dataSourceId),
                formStatus: getFormStatusSignal(identity.dataSourceId),
                windowControl: windowControlSignal
            }


            const signals = {
                ...standardSignals,
                ...selectionSignals
            }
            return signals
        },

        Context: function (dataSourceRef, options = {}) {
            if (!dataSourceRef) {
                dataSourceRef = this.identity.dataSourceRef
            }
            const selectionModeOverride = String(options?.selectionMode || "").trim().toLowerCase();
            const contextCacheKey = `${dataSourceRef}::${selectionModeOverride || "default"}`;
            const identity = {
                ...this.identity,
                dataSourceRef,
                ns,
                dataSourceId: getDataSourceId(dataSourceRef)
            }
            const baseDataSource = metadata.dataSource[dataSourceRef]
            const dataSource = selectionModeOverride
                ? { ...baseDataSource, selectionMode: selectionModeOverride }
                : baseDataSource;
            if (!dataSource) {
                throw new Error(`DataSource not found: ${dataSourceRef}`, identity)
            }

            let result = dataSourceContextCache[contextCacheKey]
            if (result) {
                return result
            }

            const initialSelectionValue =
                dataSource.selectionMode === 'multi' ? {selection: []} : {selected: null, rowIndex: -1};
            const hasSelection = dataSource.selectionMode !== 'none'
            const selectionSignals = hasSelection ? {
                collection: getCollectionSignal(identity.dataSourceId),
                collectionInfo: getCollectionInfoSignal(identity.dataSourceId),
                selection: getSelectionSignal(identity.dataSourceId, initialSelectionValue),
                metrics: getMetricsSignal(identity.dataSourceId),

            } : {}

            const standardSignals = {
                input: getInputSignal(identity.dataSourceId),
                form: getFormSignal(identity.dataSourceId),
                windowForm: getFormSignal(`${windowId}:windowForm`),
                control: getControlSignal(identity.dataSourceId),
                message: getMessageSignal(identity.dataSourceId),
                formStatus: getFormStatusSignal(identity.dataSourceId),
                windowControl: windowControlSignal
            }


            const signals = {
                ...standardSignals,
                ...selectionSignals
            }


            const connector = createDataConnector(dataSource, connectorRuntime);
            result = {
                ...this,
                // Preserve existing handlers (e.g., dialog) and merge DS/window + services
                handlers: {
                    ...this.handlers,
                    ...this._globalServices,
                },
                identity,
                connector,
                signals,
                dataSource,
                itemId: (container, item) => {
                    return `${windowId}DS${dataSourceRef}.(${container.id}||'').${item.id}`
                },
                getSignalId: (key) => {
                    this.signalIds[key] = true
                    return `${windowId}DS${dataSourceRef}Signal${key}`
                },
                tableSettingKey: (key) => {
                    return `${windowId}DS${dataSourceRef}Table${key}`
                }

            };
            result.handlers = {
                // inherit parent handlers (including dialog for dialog contexts)
                ...result.handlers,
                dataSource: useDataSourceHandlers(identity, signals, metadata.dataSource, connector),
                window: windowHandlers,
                ...this._globalServices,
            }
            result.actions = metadata.actions.import(result) || {}

            result.lookupHandler = (name) => {
                return resolveActionHandler(result.actions, result.handlers, name);
            }
            dataSourceContextCache[contextCacheKey] = result
            this.dataSources[contextCacheKey] = dataSourceContextCache[contextCacheKey];
            return dataSourceContextCache[contextCacheKey];
        },

        // Hook-safe variant for React components. Always call from inside a component.
        useDsContext: function (dataSourceRef, options = {}) {
            if (!dataSourceRef) {
                dataSourceRef = this.identity.dataSourceRef;
            }
            const selectionModeOverride = String(options?.selectionMode || "").trim().toLowerCase();
            const contextCacheKey = `${dataSourceRef}::${selectionModeOverride || "default"}`;

            const identity = {
                ...this.identity,
                dataSourceRef,
                ns,
                dataSourceId: getDataSourceId(dataSourceRef)
            };
            const baseDataSource = metadata.dataSource[dataSourceRef];
            const dataSource = selectionModeOverride
                ? { ...baseDataSource, selectionMode: selectionModeOverride }
                : baseDataSource;
            if (!dataSource) {
                throw new Error(`DataSource not found: ${dataSourceRef}`, identity);
            }

            const connector = createDataConnector(dataSource, connectorRuntime);

            let cached = dataSourceContextCache[contextCacheKey];
            if (cached) {
                return cached;
            }

            const initialSelectionValue =
                dataSource.selectionMode === 'multi' ? {selection: []} : {selected: null, rowIndex: -1};
            const hasSelection = dataSource.selectionMode !== 'none';
            const selectionSignals = hasSelection ? {
                collection: getCollectionSignal(identity.dataSourceId),
                collectionInfo: getCollectionInfoSignal(identity.dataSourceId),
                selection: getSelectionSignal(identity.dataSourceId, initialSelectionValue),
                metrics: getMetricsSignal(identity.dataSourceId),
            } : {};

            const standardSignals = {
                input: getInputSignal(identity.dataSourceId),
                form: getFormSignal(identity.dataSourceId),
                windowForm: getFormSignal(`${windowId}:windowForm`),
                control: getControlSignal(identity.dataSourceId),
                message: getMessageSignal(identity.dataSourceId),
                formStatus: getFormStatusSignal(identity.dataSourceId),
                windowControl: windowControlSignal,
            };

            const signals = {...standardSignals, ...selectionSignals};

            const result = {
                ...this,
                // Preserve existing handlers (e.g., dialog) and merge DS/window + services
                handlers: {...this.handlers, ...this._globalServices},
                identity,
                connector,
                signals,
                dataSource,
                itemId: (container, item) => `${windowId}DS${dataSourceRef}.(${container.id}||'').${item.id}`,
                getSignalId: (key) => {
                    this.signalIds[key] = true;
                    return `${windowId}DS${dataSourceRef}Signal${key}`;
                },
                tableSettingKey: (key) => `${windowId}DS${dataSourceRef}Table${key}`,
            };

            result.handlers = {
                ...result.handlers,
                dataSource: useDataSourceHandlers(identity, signals, metadata.dataSource, connector),
                window: windowHandlers,
                ...this._globalServices,
            };
            result.actions = metadata.actions.import(result) || {};
            result.lookupHandler = (name) => resolveActionHandler(result.actions, result.handlers, name);

            dataSourceContextCache[contextCacheKey] = result;
            this.dataSources[contextCacheKey] = dataSourceContextCache[contextCacheKey];
            return dataSourceContextCache[contextCacheKey];
        }


    };
};
