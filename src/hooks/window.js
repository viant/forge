// useGenericDataSourceHandlers.js
import {
    addWindow,
    getDialogSignal, removeSignalsForKey,
} from "../core/store/signals.js";
import { getWindowContext } from "../core/context/registry.js";
import { resolveSelector } from "../utils/selector.js";
import { resolveParameters } from './parameters.js';
import {buildStandaloneDashboardDocument, downloadDashboardHtml} from "../core/ui/dashboardExport.js";
import {getBusSignal, getDashboardFilterSignal, getDashboardSelectionSignal} from "../core/store/signals.js";
import {buildDashboardDefaultFilters, setDashboardSelectionState} from "../components/dashboard/dashboardUtils.js";

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

        // Prefer an explicit context passed by the caller (dialog dataSource
        // context). Fallback to the window's default DS context.
        let selectionCtx = props && props.context ? props.context : null;
        if (!selectionCtx) {
            try {
                const dialogCtxBase = getWindowContext(windowId);
                if (dialogCtxBase) {
                    selectionCtx = dialogCtxBase.Context(dialogCtxBase.identity.dataSourceRef);
                }
            } catch (_) {
                // ignore – fallback unavailable
            }
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
        try { console.debug('[dialog.commit] incoming payload (pre-derive)', payload); } catch (_) {}
        const dialogKey = getDialogId(dialogId);
        const entry = pendingDialogResolvers.get(dialogKey);

        if (entry) {
            const { resolve, outbound = [], caller } = entry;
            try { console.debug('[dialog.commit] entry', { outbound, caller }); } catch (_) {}

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

            try { console.debug('[dialog.commit] resolve(payload)', payload); } catch (_) {}
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
            if (maybe && (maybe.awaitResult !== undefined || maybe.parameters || maybe.newInstance !== undefined || maybe.autoIndexTitle !== undefined)) {
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

        // Resolve inbound parameters (seed initial DS inputs before mount)
        let inboundParams = {};
        try {
            const callerBase = getWindowContext(windowId);
            const callerRef = props.context?.identity?.dataSourceRef || (callerBase?.identity?.dataSourceRef);
            const callerCtx = callerBase ? callerBase.Context(callerRef) : null;
            if (callerCtx) {
                const resolved = resolveParameters(paramDefs || [], callerCtx) || {};
                inboundParams = resolved.inbound || resolved; // support both shapes
            }
        } catch (e) {
            console.warn('[openWindow] resolveParameters error', e);
        }

        // Prefer explicit parameters passed by caller; otherwise use inbound
        const initialParameters = (parameters && Object.keys(parameters).length > 0)
            ? parameters
            : inboundParams;

        // If modal requested, force floating overlay
        const modal = options && options.modal === true;
        const sizeOpt = options && (options.size || {});
        const widthOpt = options && options.width;
        const heightOpt = options && options.height;
        const size = sizeOpt || ((widthOpt || heightOpt) ? { width: widthOpt, height: heightOpt } : undefined);
        const effectiveInTab = modal ? false : inTabOverride;

        const winObj = addWindow(
            windowTitle,
            windowId,
            windowKey,
            windowData,
            effectiveInTab,
            initialParameters,
            { modal, size, footer: options.footer, newInstance: options.newInstance === true, autoIndexTitle: options.autoIndexTitle === true }
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

    const exportDashboard = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const metadata = ctx?.metadata;
        const container = metadata?.view?.content;
        if (!container) {
            throw new Error(`dashboard view content not found for window: ${windowId}`);
        }

        const rootElement = typeof document !== 'undefined'
            ? document.querySelector(`[data-window-id="${windowId}"]`)
            : null;
        const filename = props?.execution?.args?.[0] || props?.parameters?.filename || `${windowId}-dashboard.html`;
        const {html} = buildStandaloneDashboardDocument({
            container,
            context: ctx,
            rootElement,
            title: container?.title,
            subtitle: container?.subtitle,
        });
        downloadDashboardHtml({html, filename});
        return true;
    }

    const setDashboardFilter = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || ctx?.metadata?.view?.content?.id || 'dashboard';
        const patch = props?.execution?.args?.[1] || props?.parameters?.patch || {};
        const dashboardKey = `${windowId}:${dashboardId}`;
        const filterSignal = getDashboardFilterSignal(dashboardKey);
        filterSignal.value = {
            ...(filterSignal.peek() || {}),
            ...(patch || {}),
        };
        return true;
    }

    const clearDashboardFilters = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || ctx?.metadata?.view?.content?.id || 'dashboard';
        const fields = props?.execution?.args?.[1] || props?.parameters?.fields || null;
        const dashboardKey = `${windowId}:${dashboardId}`;
        const filterSignal = getDashboardFilterSignal(dashboardKey);
        if (Array.isArray(fields) && fields.length > 0) {
            const next = {...(filterSignal.peek() || {})};
            fields.forEach((field) => delete next[field]);
            filterSignal.value = next;
        } else {
            filterSignal.value = {};
        }
        return true;
    }

    const setDashboardSelection = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || ctx?.metadata?.view?.content?.id || 'dashboard';
        const selectionPatch = props?.execution?.args?.[1] || props?.parameters || {};
        const dashboardKey = `${windowId}:${dashboardId}`;
        setDashboardSelectionState({
            windowId,
            dashboardKey,
            dimension: selectionPatch.dimension || null,
            entityKey: selectionPatch.entityKey ?? null,
            pointKey: selectionPatch.pointKey ?? null,
            selected: selectionPatch.selected ?? null,
            sourceBlockId: selectionPatch.sourceBlockId || null,
        });
        return true;
    }

    const clearDashboardSelection = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || ctx?.metadata?.view?.content?.id || 'dashboard';
        const sourceBlockId = props?.execution?.args?.[1]?.sourceBlockId || props?.parameters?.sourceBlockId || null;
        const dashboardKey = `${windowId}:${dashboardId}`;
        setDashboardSelectionState({
            windowId,
            dashboardKey,
            dimension: null,
            entityKey: null,
            pointKey: null,
            selected: null,
            sourceBlockId,
        });
        return true;
    }

    const resetDashboardState = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const container = ctx?.metadata?.view?.content || null;
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || container?.id || 'dashboard';
        const dashboardKey = `${windowId}:${dashboardId}`;
        const defaults = buildDashboardDefaultFilters(container);

        getDashboardFilterSignal(dashboardKey).value = defaults;
        setDashboardSelectionState({
            windowId,
            dashboardKey,
            dimension: null,
            entityKey: null,
            pointKey: null,
            selected: null,
            sourceBlockId: 'window.resetDashboardState',
        });
        return true;
    }

    const getDashboardState = (props = {}) => {
        const base = getWindowContext(windowId);
        const ctx = props.context || base?.Context?.(base?.identity?.dataSourceRef);
        const container = ctx?.metadata?.view?.content || null;
        const dashboardId = props?.execution?.args?.[0] || props?.parameters?.dashboardId || container?.id || 'dashboard';
        const dashboardKey = `${windowId}:${dashboardId}`;
        return {
            ok: true,
            windowId,
            dashboardId,
            dashboardKey,
            title: container?.title || '',
            filters: getDashboardFilterSignal(dashboardKey).peek() || {},
            selection: getDashboardSelectionSignal(dashboardKey).peek() || {},
            blockIds: Array.isArray(container?.containers) ? container.containers.map((block) => block?.id).filter(Boolean) : [],
        };
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
        const dialogKey = getDialogId(dialogId);

        // Detect options object as last arg when typeof === 'object'
        let options = {};
        if (args.length > 1 && typeof args[args.length - 1] === 'object') {
            options = args[args.length - 1] || {};
        }
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

        // Resolve parameter definitions to a plain args object using caller context
        let argsObj = {};
        try {
            const callerBase = getWindowContext(windowId);
            const callerRef = props.context?.identity?.dataSourceRef || (callerBase?.identity?.dataSourceRef);
            const callerCtx = callerBase ? callerBase.Context(callerRef) : null;
            if (callerCtx) {
                const defs = Array.isArray(options.parameters) ? options.parameters : parameterDefinitions;
                argsObj = resolveParameters(defs || [], callerCtx) || {};
            }
        } catch (e) {
            console.warn('[openDialog] resolveParameters error', e);
        }

        // Set dialog signal (open + props + args) in a single write to avoid reactive cycles
        try {
            const sig = getDialogSignal(dialogKey);
            const prev = sig.peek();
            sig.value = {
                ...prev,
                open: true,
                props: { ...props, parameters },
                args: argsObj,
            };
        } catch (_) {
            // Fallback to legacy helper
            openViewDialog(dialogSignal, { ...props, parameters });
        }

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
        const { dialogId } = props || {};
        if (!dialogId) return;
        const sig = getDialogSignal(getDialogId(dialogId));
        closeViewDialog(sig);
    }

    const callerArgs = () => {
        const sig = getDialogSignal(getDialogId(dialogId));
        return dialogArgs(sig);
    }

    return {
        openWindow,
        closeWindow,
        exportDashboard,
        setDashboardFilter,
        clearDashboardFilters,
        setDashboardSelection,
        clearDashboardSelection,
        resetDashboardState,
        getDashboardState,
        openDialog,
        closeDialog,
        callerArgs,
        commit: commitWindow,
    }

}
