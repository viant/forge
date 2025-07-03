// useGenericDataSourceHandlers.js
import {
    addWindow,
    getDialogSignal, removeSignalsForKey,
} from "../core";
import { getWindowContext } from "../core/context/Context.jsx";
import { resolveSelector } from "../utils/selector.js";

const openViewDialog = (dialogSignal, props) => {
    dialogSignal.value = {...dialogSignal.peek(), open: true, props};
}

const dialogArgs = (dialogSignal) => {
    return dialogSignal.peek().args || {};
}


const closeViewDialog = (dialogSignal) => {
    dialogSignal.value = {...dialogSignal.peek(), open: false};
}


export function useDialogHandlers(windowId, dialogId) {
    const getDialogId = () => {
        return `${windowId}Dialog${dialogId}`;
    }

    const close = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        closeViewDialog(dialogSignal)
    }

    const commit = (props = {}) => {
        let { payload } = props;

        // Attempt to derive selection context once to use in fallback logic
        let selectionCtx = null;
        try {
            const dialogCtxBase = getWindowContext(windowId);
            if (dialogCtxBase) {
                selectionCtx = dialogCtxBase.Context(dialogCtxBase.identity.dataSourceRef);
            }
        } catch (_) {
            // ignore – fallback unavailable
        }

        // If no explicit payload, try to derive from current selection – mirrors
        // behaviour implemented for commitWindow so dialogs can simply return
        // the selected row without extra wiring.
        if (
            (!payload || (Array.isArray(payload) ? payload.length === 0 : Object.keys(payload).length === 0)) &&
            selectionCtx?.handlers?.dataSource?.getSelection
        ) {
            try {
                const sel = selectionCtx.handlers.dataSource.getSelection();
                if (sel && (sel.selected || sel.selection)) {
                    payload = sel.selected ?? sel.selection ?? sel;
                }
            } catch (e) {
                console.warn('commitDialog: failed to derive payload from selection', e);
            }
        }
        const dialogKey = getDialogId(dialogId);
        const entry = pendingDialogResolvers.get(dialogKey);

        if (entry) {
            const { resolve, outbound = [], caller } = entry;

            if (caller && outbound.length > 0) {
                try {
                    const callerCtxBase = getWindowContext(caller.windowId);
                    if (callerCtxBase) {
                        const callerCtx = callerCtxBase.Context(caller.dataSourceRef);

                        const parseStore = (str) => {
                            const [dsRaw, storeRaw] = str.split(':');
                            let store = storeRaw;
                            if (store === 'query') store = 'input.query';
                            if (store === 'path') store = 'input.path';
                            if (store === 'headers') store = 'input.headers';
                            if (store === 'body') store = 'input.body';
                            if (store === 'headers') store = 'input.headers';
                            if (store === 'body') store = 'input.body';
                            const ds = dsRaw || caller.dataSourceRef;
                            return { ds, store };
                        };

                        outbound.forEach((row) => {
                            const val = resolveSelector(payload, row.location || row.name);
                            const { ds, store } = parseStore(row.to);
                            const targetCtx = ds === caller.dataSourceRef ? callerCtx : callerCtxBase.Context(ds);

                            switch (store) {
                                case 'form':
                                    targetCtx.handlers.dataSource.setFormField({ item: { id: row.name, bindingPath: row.name }, value: val });
                                    break;
                                case 'filter':
                                    targetCtx.handlers.dataSource.setFilterValue({ item: { id: row.name, bindingPath: row.name }, value: val });
                                    break;
                                case 'selection':
                                    targetCtx.handlers.dataSource.setSelected({ selected: val });
                                    break;
                                case 'metrics':
                                    targetCtx.signals.metrics.value = {
                                        ...targetCtx.signals.metrics.peek(),
                                        [row.name]: val,
                                    };
                                    break;
                                case 'input.query':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        query: { ...(targetCtx.signals.input.peek().query || {}), [row.name]: val },
                                    };
                                    break;
                                case 'input.headers':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        headers: { ...(targetCtx.signals.input.peek().headers || {}), [row.name]: val },
                                    };
                                    break;
                                case 'input.body':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        body: { ...(targetCtx.signals.input.peek().body || {}), [row.name]: val },
                                    };
                                    break;
                                case 'input.path':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        path: { ...(targetCtx.signals.input.peek().path || {}), [row.name]: val },
                                    };
                                    break;
                                default:
                                    console.warn('commitDialog: unsupported store', store);
                            }
                        });
                    }
                } catch (e) {
                    console.error('commitDialog outbound processing error', e);
                }
            }

            if (resolve) resolve(payload);
            pendingDialogResolvers.delete(dialogKey);
        }
        // close dialog after commit
        close();
    }

    const callerArgs = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        return dialogArgs(dialogSignal)
    }
    const isOpen = () => {
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        return dialogSignal.value?.open || false
    }

    return {
        isOpen,
        callerArgs,
        close,
        commit
    }

}


// Global map of pending dialog resolvers.  Keyed by dialog signal id.
const pendingDialogResolvers  = new Map();
const pendingWindowResolvers  = new Map();

export function useWindowHandlers(windowId) {

    const inTab = true;
    const getDialogId = (id) => `${windowId}Dialog${id}`;
    const openWindow = (props = {}) => {


        const { execution = {}, parameters = {} } = props; // parameters = legacy map
        const parameterDefinitions = Array.isArray(execution.parameters) ? execution.parameters : [];


        const rawArgs = [...(execution.args || [])];

        let options = {};
        if (rawArgs.length > 0 && typeof rawArgs[rawArgs.length - 1] === 'object') {
            const maybe = rawArgs[rawArgs.length - 1];
            if (maybe && (maybe.awaitResult !== undefined || maybe.parameters)) {
                options = rawArgs.pop();
            }
        }

        const windowKey   = rawArgs[0];
        const windowTitle = rawArgs[1] ?? '';
        const windowData  = rawArgs.length > 2 ? rawArgs[2] : '';
        const inTabOverride = rawArgs.length > 3 ? rawArgs[3] : inTab;

        const paramDefs = Array.isArray(options.parameters)
            ? options.parameters
            : parameterDefinitions;

        // Separate outbound rows (from param definitions)
        const outbound = paramDefs.filter((p) => {
            if (p.direction === 'out') return true;
            if (p.output === true) return true;
            if (typeof p.from === 'string' && p.from.endsWith(':output')) return true;
            return false;
        });

        const winObj = addWindow(
            windowTitle,
            windowId,
            windowKey,
            windowData,
            inTabOverride,
            parameters
        );

        const entryBase = {
            resolve: null,
            options,
            outbound,
            caller: {
                windowId,
                dataSourceRef: props.context?.identity?.dataSourceRef || undefined,
            },
        };

        if (options.awaitResult) {
            return new Promise((resolve) => {
                pendingWindowResolvers.set(winObj.windowId, {
                    ...entryBase,
                    resolve,
                });
            });
        } else if (outbound.length > 0) {
            pendingWindowResolvers.set(winObj.windowId, entryBase);
        }
        return undefined;
    };


    const closeWindow = (props = {}) => {
        removeSignalsForKey(windowId);
    }

    const commitWindow = (props = {}) => {
        let { payload = {} } = props;

        // If caller did not supply an explicit payload, fall back to using
        // the currently selected record of the active data source (when
        // available).  This mirrors the behaviour of legacy Forge metadata
        // where toolbar actions implicitly operate on the selected row.
        if (
            (!payload || (Array.isArray(payload) ? payload.length === 0 : Object.keys(payload).length === 0)) &&
            props?.context?.handlers?.dataSource?.getSelection
        ) {
            try {
                const sel = props.context.handlers.dataSource.getSelection();
                if (sel && (sel.selected || sel.selection)) {
                    // Normalise to object; multi-selection returns {selection: []}
                    payload = sel.selected ?? sel.selection ?? sel;
                }
            } catch (e) {
                // Non-fatal – fall back to empty payload when selection lookup fails
                console.warn('commitWindow: failed to derive payload from selection', e);
            }
        }
        const entry = pendingWindowResolvers.get(windowId);
        if (entry) {
            const { resolve, outbound = [], caller } = entry;

            if (caller && outbound.length > 0) {
                try {
                    const callerCtxBase = getWindowContext(caller.windowId);
                    if (callerCtxBase) {
                        const callerCtx = callerCtxBase.Context(caller.dataSourceRef);

                        const parseStore = (str) => {
                            const [dsRaw, storeRaw] = str.split(':');
                            const ds = dsRaw || caller.dataSourceRef;
                            return { ds, store: storeRaw };
                        };

                        outbound.forEach((row) => {
                            const valPath = row.location || row.name;
                            const value = resolveSelector(payload, valPath);

                            let { ds, store } = parseStore(row.to);
                            if (store === 'query') store = 'input.query';
                            if (store === 'path') store = 'input.path';
                            const targetCtx = ds === caller.dataSourceRef ? callerCtx : callerCtxBase.Context(ds);

                            switch (store) {
                                case 'form':
                                    targetCtx.handlers.dataSource.setFormField({ item: { id: row.name, bindingPath: row.name }, value });
                                    break;
                                case 'filter':
                                    targetCtx.handlers.dataSource.setFilterValue({ item: { id: row.name, bindingPath: row.name }, value });
                                    break;
                                case 'selection':
                                    targetCtx.handlers.dataSource.setSelected({ selected: value });
                                    break;
                                case 'metrics':
                                    targetCtx.signals.metrics.value = {
                                        ...targetCtx.signals.metrics.peek(),
                                        [row.name]: value,
                                    };
                                    break;
                                case 'input.query':
                                case 'query':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        query: { ...(targetCtx.signals.input.peek().query || {}), [row.name]: value },
                                    };
                                    break;
                                case 'input.headers':
                                case 'headers':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        headers: { ...(targetCtx.signals.input.peek().headers || {}), [row.name]: value },
                                    };
                                    break;
                                case 'input.body':
                                case 'body':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        body: { ...(targetCtx.signals.input.peek().body || {}), [row.name]: value },
                                    };
                                    break;
                                case 'input.path':
                                case 'path':
                                    targetCtx.signals.input.value = {
                                        ...targetCtx.signals.input.peek(),
                                        path: { ...(targetCtx.signals.input.peek().path || {}), [row.name]: value },
                                    };
                                    break;
                                default:
                                    console.warn('commitWindow: unsupported store', store);
                            }
                        });
                    }
                } catch (e) {
                    console.error('commitWindow outbound processing error', e);
                }
            }

            if (resolve) resolve(payload);
            pendingWindowResolvers.delete(windowId);
        }
        closeWindow();
    };


    const openDialog = (props = {}) => {
        const { execution = {}, parameters = {} } = props;
        const { args = [] } = execution;

        if (args.length === 0) throw new Error('args[0] (dialog id) required');

        const dialogId = args[0];

        // Detect options object as last arg when typeof === 'object'
        let options = {};
        if (args.length > 1 && typeof args[args.length - 1] === 'object') {
            options = args[args.length - 1] || {};
        }

        const dialogKey = getDialogId(dialogId);
        const dialogSignal = getDialogSignal(dialogKey);

        const parameterDefinitions = Array.isArray(execution.parameters) ? execution.parameters : [];
        const paramDefs = Array.isArray(options.parameters)
            ? options.parameters
            : parameterDefinitions;
        const outbound = paramDefs.filter((p) => {
            if (p.direction === 'out') return true;
            if (p.output === true) return true;
            if (typeof p.from === 'string' && p.from.endsWith(':output')) return true;
            return false;
        });

        openViewDialog(dialogSignal, { ...props, parameters });

        const entryBase = {
            resolve: null,
            options,
            outbound,
            caller: {
                windowId,
                dataSourceRef: props.context?.identity?.dataSourceRef || undefined,
            },
        };

        if (options.awaitResult) {
            return new Promise((resolve) => {
                pendingDialogResolvers.set(dialogKey, { ...entryBase, resolve });
            });
        } else if (outbound.length > 0) {
            pendingDialogResolvers.set(dialogKey, entryBase);
        }
        return undefined;
    };

    const closeDialog = (props = {}) => {
        const {dialogId} = args
        const dialogSignal = getDialogSignal(getDialogId(dialogId))
        closeViewDialog(dialogSignal)
    }

    const callerArgs = () => {
        return dialogArgs(dialogArgs)
    }

    return {
        openWindow,
        closeWindow,
        openDialog,
        closeDialog,
        callerArgs,
        commit: commitWindow,
    }

}
