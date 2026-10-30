import {signal} from '@preact/signals-react';

import {generateIntHash} from "../../utils/hash.js";
import { injectActions } from '../../actions/action.js';
import {clearWindowContext} from '../context/registry.js';
import {invalidateWindowDataSourceRequests, invalidateDataSourceRequests} from '../../components/dataSourceRequestLifecycle.js';
import {snapshotWindowResourceLocator} from '../../runtime/windowResourceLocator.js';
// Create per-key signals for metadata and data


export const inputSignals = signal({});

export const dataSignals = signal({});
export const selectionSignals = signal({});

export const formSignals = signal({});
export const collectionInfoSignals = signal({});
export const metricsSignals = signal({});


export const dialogSignals = signal({});

export const viewSignals = signal({});
export const messageSignals = signal({});

// ---------------------------------------------------------------------------
//  Global & window-level application status signals
// ---------------------------------------------------------------------------

// Shape suggestion: { busy:false, error:null, notice:null }
export const appStatusSignal = signal({});

const windowStatusSignals = signal({});

export const getWindowStatusSignal = (windowId) => {
    if (!windowStatusSignals.value[windowId]) {
        // Initialise with current global snapshot so first focus is in sync
        windowStatusSignals.value = {
            ...windowStatusSignals.peek(),
            [windowId]: signal(appStatusSignal.peek()),
        };
    }
    return windowStatusSignals.value[windowId];
};


// ---------------------------------------------------------------------------
//  Message-Bus signals (client-side, window-scoped)
// ---------------------------------------------------------------------------

// Each active window gets its own bus signal that stores an **array** of
// arbitrary message objects.  Components can push to the array (sending a
// message) and watch the signal re-actively (receiving messages).

export const busSignals = signal({});

export const dashboardFilterSignals = signal({});
export const dashboardSelectionSignals = signal({});

export const getBusSignal = (windowId) => {
    if (!busSignals.value[windowId]) {
        const newSignal = signal([]);
        busSignals.value = {
            ...busSignals.peek(),
            [windowId]: newSignal,
        };
    }
    return busSignals.value[windowId];
};

export const findBusSignal = (windowId) => {
    return busSignals.value[windowId] || null;
};

export const getDashboardFilterSignal = (dashboardKey, initialValue = {}) => {
    if (!dashboardFilterSignals.value[dashboardKey]) {
        dashboardFilterSignals.value = {
            ...dashboardFilterSignals.peek(),
            [dashboardKey]: signal(initialValue),
        };
    }
    return dashboardFilterSignals.value[dashboardKey];
};

export const findDashboardFilterSignal = (dashboardKey) => {
    return dashboardFilterSignals.value[dashboardKey] || null;
};

export const getDashboardSelectionSignal = (
    dashboardKey,
    initialValue = {dimension: null, entityKey: null, pointKey: null},
) => {
    if (!dashboardSelectionSignals.value[dashboardKey]) {
        dashboardSelectionSignals.value = {
            ...dashboardSelectionSignals.peek(),
            [dashboardKey]: signal(initialValue),
        };
    }
    return dashboardSelectionSignals.value[dashboardKey];
};

export const findDashboardSelectionSignal = (dashboardKey) => {
    return dashboardSelectionSignals.value[dashboardKey] || null;
};


export const controlSignals = signal({});


export const metadataSignals = signal({});
export const protectedWindowDenials = signal({});
const signalOwners = new Map();

const registerSignalOwner = (windowId, key) => {
    const owner = String(windowId || '').trim();
    if (!owner || !key) return;
    const owners = signalOwners.get(key) || new Set();
    owners.add(owner);
    signalOwners.set(key, owners);
};

const matchesWindowSignalKey = (key, id) => key === id || key.startsWith(`${id}DS`) || key.startsWith(`${id}Dialog`) || key.startsWith(`${id}:`);

const windowOwnsSignalKey = (key, windowId, knownWindowIds) => {
    const explicit = signalOwners.get(key);
    if (explicit) return explicit.has(windowId);
    if (!matchesWindowSignalKey(key, windowId)) return false;
    return !knownWindowIds.some(other => other !== windowId && other.length > windowId.length && matchesWindowSignalKey(key, other));
};



// Get or create metadata signal for a unique window key
export const getMetadataSignal = (windowId) => {
    registerSignalOwner(windowId, windowId);
    if (!metadataSignals.value[windowId]) {
        const newSignal = signal(null);
        metadataSignals.value = {
            ...metadataSignals.peek(),
            [windowId]: newSignal,
        };
    }
    return metadataSignals.value[windowId];
};

export const findMetadataSignal = (windowId) => {
    return metadataSignals.value[windowId] || null;
};



// Get or create data signal for a unique window key
export const getInputSignal = (sourceId, initialFilter) => {
    if (!inputSignals.value[sourceId]) {
        const newSignal = signal({fetch: false, refresh: false});
        inputSignals.value = {
            ...inputSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    const result = inputSignals.value[sourceId];
    const current = result.peek();
    if (initialFilter && typeof initialFilter === 'object' && !Array.isArray(initialFilter)
        && !Object.prototype.hasOwnProperty.call(current, 'filter')) {
        result.value = {...current, filter: structuredClone(initialFilter)};
    }
    return result;
};

export const findInputSignal = (sourceId) => {
    return inputSignals.value[sourceId] || null;
};



// Get or create data signal for a unique window key
export const getCollectionSignal = (sourceId) => {
    if (!dataSignals.value[sourceId]) {
        const newSignal = signal([]);
        dataSignals.value = {
            ...dataSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return dataSignals.value[sourceId];
};

export const findCollectionSignal = (sourceId) => {
    return dataSignals.value[sourceId] || null;
};


// Get or create data signal for a unique window key
export const getSelectionSignal = (sourceId, initialValue) => {
    if (!selectionSignals.value[sourceId]) {
        const newSignal = signal(initialValue);
        selectionSignals.value = {
            ...selectionSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return selectionSignals.value[sourceId];
};

export const findSelectionSignal = (sourceId) => {
    return selectionSignals.value[sourceId] || null;
};



// Get or create data signal for a unique window key
export const getFormSignal = (sourceId) => {
    if (!formSignals.value[sourceId]) {
        const newSignal = signal({});
        formSignals.value = {
            ...formSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return formSignals.value[sourceId];
};

export const findFormSignal = (sourceId) => {
    return formSignals.value[sourceId] || null;
};

export const getMessageSignal = (sourceId) => {
    if (!messageSignals.value[sourceId]) {
        const newSignal = signal([]);
        messageSignals.value = {
            ...messageSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return messageSignals.value[sourceId];
}

export const findMessageSignal = (sourceId) => {
    return messageSignals.value[sourceId] || null;
}


export const getDialogSignal = (sourceId) => {
    if (!dialogSignals.value[sourceId]) {
        const newSignal = signal([]);
        dialogSignals.value = {
            ...dialogSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return dialogSignals.value[sourceId];
}

export const findDialogSignal = (sourceId) => {
    return dialogSignals.value[sourceId] || null;
};



// Get or create data signal for a unique window key
export const getCollectionInfoSignal = (sourceId) => {
    if (!collectionInfoSignals.value[sourceId]) {
        const newSignal = signal({});
        collectionInfoSignals.value = {
            ...collectionInfoSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return collectionInfoSignals.value[sourceId];
};

export const findCollectionInfoSignal = (sourceId) => {
    return collectionInfoSignals.value[sourceId] || null;
};



// Get or create metric signal for sourceId
export const getMetricsSignal = (sourceId) => {
    //console.log("getMetricsSignal for key", sourceId);
    if (!metricsSignals.value[sourceId]) {
        const newSignal = signal({});
        metricsSignals.value = {
            ...metricsSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return metricsSignals.value[sourceId];
};

export const findMetricsSignal = (sourceId) => {
    return metricsSignals.value[sourceId] || null;
};


// Get or create data signal for a unique window key
export const getControlSignal = (sourceId) => {
    //console.log("getControlSignal for key", sourceId);
    if (!controlSignals.value[sourceId]) {
        const newSignal = signal({'loading':false, 'error': null});
        controlSignals.value = {
            ...controlSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return controlSignals.value[sourceId];
};

export const findControlSignal = (sourceId) => {
    return controlSignals.value[sourceId] || null;
};

// -------------------------------------------------------------
// Form status (dirty flag) signal
// -------------------------------------------------------------
const formStatusSignals = signal({}); // map id → signal

export const getFormStatusSignal = (sourceId) => {
    if (!formStatusSignals.value[sourceId]) {
        const newSignal = signal({ dirty: false, version: 0 });
        formStatusSignals.value = {
            ...formStatusSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return formStatusSignals.value[sourceId];
};

export const findFormStatusSignal = (sourceId) => {
    return formStatusSignals.value[sourceId] || null;
};


// Get or create data signal for a unique window key
export const getViewSignal = (sourceId) => {
    //console.log("getViewSignal for key", sourceId);
    if (!viewSignals.value[sourceId]) {
        const newSignal = signal({});
        viewSignals.value = {
            ...viewSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return viewSignals.value[sourceId];
};

export const findViewSignal = (sourceId) => {
    return viewSignals.value[sourceId] || null;
};

export const primeWindowSignals = (windowId, metadata = null) => {
    const id = String(windowId || '').trim();
    if (!id || !metadata || typeof metadata !== 'object') return;

    registerSignalOwner(id, id);
    registerSignalOwner(id, `${id}:windowForm`);

    getBusSignal(id);
    getControlSignal(id);
    getFormSignal(`${id}:windowForm`);
    getViewSignal(id);
    getMessageSignal(id);

    const dataSources = metadata?.dataSource && typeof metadata.dataSource === 'object'
        ? metadata.dataSource
        : {};
    for (const [dataSourceRef, dataSource] of Object.entries(dataSources)) {
        const sourceId = `${id}DS${dataSourceRef}`;
        registerSignalOwner(id, sourceId);
        getInputSignal(sourceId);
        getControlSignal(sourceId);
        getFormSignal(sourceId);
        getCollectionSignal(sourceId);
        getCollectionInfoSignal(sourceId);
        getMetricsSignal(sourceId);
        getMessageSignal(sourceId);
        getFormStatusSignal(sourceId);

        const selectionMode = String(dataSource?.selectionMode || '').trim().toLowerCase();
        const initialSelection = selectionMode === 'multi'
            ? { selection: [] }
            : { selected: null, rowIndex: -1 };
        getSelectionSignal(sourceId, initialSelection);
    }

    const dialogs = Array.isArray(metadata?.dialogs) ? metadata.dialogs : [];
    for (const dialog of dialogs) {
        const dialogId = String(dialog?.id || '').trim();
        if (!dialogId) continue;
        registerSignalOwner(id, `${id}Dialog${dialogId}`);
        getDialogSignal(`${id}Dialog${dialogId}`);
    }
};

// Drop protected results and drafts in place when the verified context or
// snapshot lease changes. Keep signal objects registered so the same window can
// complete a fresh preflight without retaining data from the old context.
const protectedWindowEpochs = new Map();
let nextProtectedWindowEpoch = 0;

export const protectedWindowEpoch = (windowId) => protectedWindowEpochs.get(String(windowId || '').trim()) || 0;

export const clearProtectedWindowState = (windowId) => {
    const id = String(windowId || '').trim();
    if (!id) return;
    protectedWindowEpochs.set(id, ++nextProtectedWindowEpoch);
    invalidateWindowDataSourceRequests(id);
    const knownWindowIds = Object.keys(metadataSignals.peek());
    const belongs = key => windowOwnsSignalKey(key, id, knownWindowIds);
    const reset = (registry, value) => {
        for (const [key, entry] of Object.entries(registry.peek())) {
            if (belongs(key)) entry.value = typeof value === 'function' ? value() : value;
        }
    };
    reset(metadataSignals, null);
    reset(dataSignals, () => []);
    reset(inputSignals, () => ({fetch: false, refresh: false}));
    reset(controlSignals, () => ({loading: false, error: null}));
    reset(formSignals, () => ({}));
    reset(viewSignals, () => ({}));
    reset(selectionSignals, () => ({selected: null, rowIndex: -1, selection: []}));
    reset(collectionInfoSignals, () => ({}));
    reset(metricsSignals, () => ({}));
    reset(messageSignals, () => []);
    reset(dialogSignals, () => []);
    reset(formStatusSignals, () => ({dirty: false, version: 0}));
    reset(busSignals, () => []);
    reset(dashboardFilterSignals, () => ({}));
    reset(dashboardSelectionSignals, () => ({}));
};

// Scoped denial keeps window identity, filters and other authorized datasets.
// The independent epoch prevents stale completions from restoring denied data.
const protectedDataSourceEpochs = new Map();
export const protectedDataSourceEpoch = sourceId => protectedDataSourceEpochs.get(String(sourceId||'')) || 0;
export const clearDeniedDataSourceState = (sourceId,error) => {
 const id=String(sourceId||'').trim();if(!id)return;
 protectedDataSourceEpochs.set(id,protectedDataSourceEpoch(id)+1);
 invalidateDataSourceRequests(id);
 const reset=(registry,value)=>{const entry=registry.peek()[id];if(entry)entry.value=value;};
 reset(dataSignals,[]);reset(formSignals,{});reset(selectionSignals,{selected:null,rowIndex:-1,selection:[]});
 reset(collectionInfoSignals,{});reset(metricsSignals,{});reset(messageSignals,[]);reset(formStatusSignals,{dirty:false,version:0});reset(busSignals,[]);
 const input=inputSignals.peek()[id];if(input)input.value={...input.peek(),fetch:false,refresh:false,invocationId:null,cache:null};
 reset(controlSignals,{loading:false,error});
};

export const denyProtectedWindow = (windowId, status = 403) => {
    const id = String(windowId || '').trim();
    if (!id) return;
    clearProtectedWindowState(id);
    protectedWindowDenials.value = {...protectedWindowDenials.peek(), [id]: {status: status === 401 ? 401 : 403}};
};

export const clearProtectedWindowDenial = (windowId) => {
    const id = String(windowId || '').trim();
    if (!id || !protectedWindowDenials.peek()[id]) return;
    const next = {...protectedWindowDenials.peek()};
    delete next[id];
    protectedWindowDenials.value = next;
};




// Remove signals for a unique window key
export const removeSignalsForKey = (windowId) => {
    const id = String(windowId || '').trim();
    if (!id) return;
    // Keep the epoch monotonic across close/reopen with the same window ID.
    protectedWindowEpochs.set(id, ++nextProtectedWindowEpoch);
    invalidateWindowDataSourceRequests(id);
    clearProtectedWindowDenial(id);
    const knownWindowIds = Object.keys(metadataSignals.peek());
    const belongs = key => windowOwnsSignalKey(key, id, knownWindowIds);
    const remove = registry => {
        const next = {...registry.peek()};
        for (const key of Object.keys(next)) if (belongs(key)) delete next[key];
        registry.value = next;
    };
    for (const registry of [metadataSignals, dataSignals, controlSignals, inputSignals,
        viewSignals, selectionSignals, collectionInfoSignals, metricsSignals,
        formSignals, messageSignals, dialogSignals, formStatusSignals, busSignals,
        dashboardFilterSignals, dashboardSelectionSignals]) remove(registry);
    for (const [key, owners] of signalOwners) {
        owners.delete(id);
        if (owners.size === 0) signalOwners.delete(key);
    }
};




export const activeWindows = signal([]);
export const selectedWindowId = signal(null);
export const selectedTabId = signal(null);

function shouldRetryRestoredDatasourceSnapshot(controlSnapshot = null) {
    if (!controlSnapshot || typeof controlSnapshot !== 'object') {
        return false;
    }
    if (controlSnapshot.loading === true) {
        return true;
    }
    const errorText = String(
        controlSnapshot?.error?.message
        || controlSnapshot?.error?.detail
        || controlSnapshot?.error
        || ''
    ).trim().toLowerCase();
    if (!errorText) {
        return false;
    }
    return (
        errorText.includes('authorization required')
        || errorText.includes('unauthorized')
        || errorText.includes('forbidden')
        || errorText.includes('user access denied')
        || errorText.includes('oauth session is missing a valid token')
    );
}

function shouldRevalidateRestoredDatasourceSnapshot(snapshot = null, controlSnapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }
    if (shouldRetryRestoredDatasourceSnapshot(controlSnapshot)) {
        return true;
    }
    if (controlSnapshot?.loaded === true) {
        return true;
    }
    if (Array.isArray(snapshot?.collection) && snapshot.collection.length > 0) {
        return true;
    }
    if (snapshot?.metrics && typeof snapshot.metrics === 'object' && Object.keys(snapshot.metrics).length > 0) {
        return true;
    }
    if (snapshot?.collectionInfo && typeof snapshot.collectionInfo === 'object' && Object.keys(snapshot.collectionInfo).length > 0) {
        return true;
    }
    return false;
}

function isSnapshotSerializationMarker(value) {
    return value === '[MaxDepth]' || value === '[Circular]';
}

function containsSnapshotSerializationMarker(value, seen = new WeakSet()) {
    if (isSnapshotSerializationMarker(value)) {
        return true;
    }
    if (!value || typeof value !== 'object') {
        return false;
    }
    if (seen.has(value)) {
        return false;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        return value.some((entry) => containsSnapshotSerializationMarker(entry, seen));
    }
    return Object.values(value).some((entry) => containsSnapshotSerializationMarker(entry, seen));
}

function restoreWindowSignalsFromSnapshot(win) {
    const windowId = String(win?.windowId || '').trim();
    if (!windowId) return;

    const inlineMetadata = win?.inlineMetadataExplicit === true ? win?.inlineMetadata : null;
    if (inlineMetadata && typeof inlineMetadata === 'object' && !containsSnapshotSerializationMarker(inlineMetadata)) {
        try {
            injectActions(inlineMetadata);
            getMetadataSignal(windowId).value = inlineMetadata;
        } catch (_) {}
    }

    if (win?.windowForm && typeof win.windowForm === 'object' && !containsSnapshotSerializationMarker(win.windowForm)) {
        getFormSignal(`${windowId}:windowForm`).value = win.windowForm;
    }

    if (win?.viewState && typeof win.viewState === 'object' && !containsSnapshotSerializationMarker(win.viewState)) {
        getViewSignal(windowId).value = win.viewState;
    }

    const dataSources = win?.dataSources && typeof win.dataSources === 'object'
        ? Object.values(win.dataSources)
        : [];
    for (const snapshot of dataSources) {
        const dataSourceRef = String(snapshot?.dataSourceRef || '').trim();
        if (!dataSourceRef) continue;
        const dataSourceId = `${windowId}DS${dataSourceRef}`;
        let nextInput = snapshot?.input && typeof snapshot.input === 'object'
            ? { ...snapshot.input }
            : null;
        let nextControl = snapshot?.control && typeof snapshot.control === 'object'
            ? { ...snapshot.control }
            : null;
        const hasSerializationMarker = [
            snapshot?.input,
            snapshot?.control,
            snapshot?.form,
            snapshot?.selection,
            snapshot?.collection,
            snapshot?.collectionInfo,
            snapshot?.metrics,
            snapshot?.formStatus,
        ].some((value) => containsSnapshotSerializationMarker(value));
        if (containsSnapshotSerializationMarker(nextInput)) {
            nextInput = null;
        }
        if (containsSnapshotSerializationMarker(nextControl)) {
            nextControl = null;
        }
        if (hasSerializationMarker || shouldRevalidateRestoredDatasourceSnapshot(snapshot, nextControl)) {
            nextInput = {
                ...(nextInput || {}),
                fetch: true,
                refresh: false,
            };
            nextControl = {
                ...nextControl,
                loading: false,
                ...(hasSerializationMarker || Object.prototype.hasOwnProperty.call(nextControl || {}, 'loaded') ? {loaded: false} : {}),
                error: null,
                stale: false,
            };
        }
        if (nextInput?.fetch === true) {
            // Runtime-only provenance: consumers can distinguish a fetch
            // promoted by restore from a new metadata/input binding. Keeping
            // it non-enumerable also means a parameter-rebinding object spread
            // consumes it before the fresh request is observed.
            Object.defineProperty(nextInput, '__forgeRestoredPendingFetch', {
                value: true,
                enumerable: false,
                configurable: true,
            });
        }
        if (nextInput && typeof nextInput === 'object') {
            getInputSignal(dataSourceId).value = nextInput;
        }
        if (nextControl && typeof nextControl === 'object') {
            getControlSignal(dataSourceId).value = nextControl;
        }
        if (hasSerializationMarker) {
            getFormSignal(dataSourceId).value = {};
            getSelectionSignal(dataSourceId, null).value = null;
            getCollectionSignal(dataSourceId).value = [];
            getCollectionInfoSignal(dataSourceId).value = {};
            getMetricsSignal(dataSourceId).value = {};
            getFormStatusSignal(dataSourceId).value = {dirty: false, version: 0};
            continue;
        }
        if (snapshot?.form && typeof snapshot.form === 'object') {
            getFormSignal(dataSourceId).value = snapshot.form;
        }
        if (Object.prototype.hasOwnProperty.call(snapshot || {}, 'selection')) {
            getSelectionSignal(dataSourceId, null).value = snapshot.selection;
        }
        if (Array.isArray(snapshot?.collection)) {
            getCollectionSignal(dataSourceId).value = snapshot.collection;
        }
        if (snapshot?.collectionInfo && typeof snapshot.collectionInfo === 'object') {
            getCollectionInfoSignal(dataSourceId).value = snapshot.collectionInfo;
        }
        if (snapshot?.metrics && typeof snapshot.metrics === 'object') {
            getMetricsSignal(dataSourceId).value = snapshot.metrics;
        }
        if (snapshot?.formStatus && typeof snapshot.formStatus === 'object') {
            getFormStatusSignal(dataSourceId).value = snapshot.formStatus;
        }
    }

    const dialogs = Array.isArray(win?.dialogs) ? win.dialogs : [];
    for (const dialog of dialogs) {
        if (containsSnapshotSerializationMarker(dialog)) continue;
        const dialogId = String(dialog?.id || '').trim();
        if (!dialogId) continue;
        const signal = getDialogSignal(`${windowId}Dialog${dialogId}`);
        const previous = signal.peek?.() || signal.value || {};
        signal.value = {
            ...previous,
            open: !!dialog?.open,
            selectionMode: dialog?.selectionMode ?? previous?.selectionMode,
            args: dialog?.args ?? previous?.args,
        };
    }
}

export const restoreWindowsFromSnapshot = (snapshot) => {
    const windows = Array.isArray(snapshot?.windows) ? snapshot.windows : [];
    const previous = Array.isArray(activeWindows.peek?.()) ? activeWindows.peek() : [];
    for (const win of previous) {
        const id = String(win?.windowId || '').trim();
        if (id) {
            removeSignalsForKey(id);
        }
    }
    activeWindows.value = windows.map((win) => ({
        windowTitle: win?.windowTitle || win?.windowKey || '',
        windowId: win?.windowId || '',
        hostOpenState: 'historical_replay',
        conversationId: win?.conversationId || null,
        parentKey: win?.parentKey || null,
        windowKey: win?.windowKey || '',
        ...snapshotWindowResourceLocator(win),
        presentation: win?.presentation || '',
        region: win?.region || '',
        workspaceSharePct: win?.workspaceSharePct ?? undefined,
        workspaceMinHeight: win?.workspaceMinHeight ?? undefined,
        workspaceObject: win?.workspaceObject && !containsSnapshotSerializationMarker(win.workspaceObject) ? win.workspaceObject : undefined,
        navigation: win?.navigation && typeof win.navigation === 'object' && !containsSnapshotSerializationMarker(win.navigation) ? { ...win.navigation } : undefined,
        navigationTrail: Array.isArray(win?.navigationTrail) && !containsSnapshotSerializationMarker(win.navigationTrail) ? win.navigationTrail : undefined,
        mcpUI: win?.mcpUI && typeof win.mcpUI === 'object' && !containsSnapshotSerializationMarker(win.mcpUI) ? { ...win.mcpUI } : undefined,
        workspaceCollapsed: win?.workspaceCollapsed === true,
        windowData: containsSnapshotSerializationMarker(win?.windowData) ? '' : (win?.windowData || ''),
        inTab: win?.inTab !== false,
        parameters: containsSnapshotSerializationMarker(win?.parameters) ? {} : (win?.parameters || {}),
        isModal: !!win?.isModal,
        isMinimized: !!win?.isMinimized,
        zIndex: win?.zIndex ?? null,
        x: win?.position?.x ?? win?.x ?? undefined,
        y: win?.position?.y ?? win?.y ?? undefined,
        size: win?.size && !containsSnapshotSerializationMarker(win.size) ? win.size : undefined,
        inlineMetadata: win?.inlineMetadataExplicit === true && win?.inlineMetadata && typeof win.inlineMetadata === 'object' && !containsSnapshotSerializationMarker(win.inlineMetadata) ? win.inlineMetadata : undefined,
        inlineMetadataExplicit: win?.inlineMetadataExplicit === true,
    }));
    for (const win of windows) {
        restoreWindowSignalsFromSnapshot(win);
    }
    selectedTabId.value = snapshot?.selected?.tabId || null;
    selectedWindowId.value = snapshot?.selected?.windowId || null;
};




let floatingWindowZIndex = 10;

// -----------------------------
// Window helpers (ids, titles)
// -----------------------------
const nextInstanceIndex = (windows, windowKey) => {
    try {
        return windows.filter((w) => w.windowKey === windowKey).length;
    } catch (_) {
        return 0;
    }
};

const computeWindowId = (baseId, forceNew, instanceIndex) => {
    if (!forceNew) return baseId;
    return `${baseId}__${Date.now()}_${(instanceIndex || 0) + 1}`;
};

const computeHostedConversationScopedWindowId = (baseId, options = {}) => {
    const conversationId = String(options.conversationId || '').trim();
    const presentation = normalizeHostedRegionKey(options.presentation);
    const region = normalizeHostedRegionKey(options.region);
    if (!conversationId || presentation !== 'hosted' || !region) return baseId;
    return `${baseId}__${conversationId}`;
};

const computeWindowTitle = (baseTitle, autoIndex, instanceIndex) => {
    if (!autoIndex || typeof baseTitle !== 'string' || baseTitle.trim().length === 0) return baseTitle;
    return `${baseTitle} <${(instanceIndex || 0) + 1}>`;
};

const normalizeHostedRegionKey = (value) => String(value || '').trim().toLowerCase();

const resolveWindowHostOpenState = (options = {}) => {
    if (!Object.prototype.hasOwnProperty.call(options || {}, 'hostOpenState')) {
        return 'fresh';
    }
    const requested = String(options?.hostOpenState || '').trim().toLowerCase();
    if (requested === 'fresh' || requested === 'historical_replay' || requested === 'user_requested') {
        return requested;
    }
    return 'unknown';
};

const currentMainChatConversationId = (windows = []) => {
    const mainChat = (Array.isArray(windows) ? windows : []).find((win) => String(win?.windowId || '').trim() === 'chat/new');
    if (!mainChat || typeof mainChat !== 'object') {
        return '';
    }
    return String(
        mainChat?.parameters?.conversations?.form?.id
        || mainChat?.parameters?.messages?.input?.parameters?.convID
        || ''
    ).trim();
};

const shouldAutoSelectWindow = (inTab, windowId, options = {}, windows = []) => {
    if (inTab === false) {
        return false;
    }
    const presentation = normalizeHostedRegionKey(options.presentation);
    const region = normalizeHostedRegionKey(options.region);
    const conversationId = String(options.conversationId || '').trim();
    if (presentation !== 'hosted' || region !== 'chat.top' || !conversationId) {
        return true;
    }
    const activeConversationId = currentMainChatConversationId(windows);
    if (!activeConversationId) {
        return true;
    }
    return activeConversationId === conversationId;
};

const resolveHostedRegionReplacementWindow = (windows, parentKey, inTab, options = {}) => {
    const conversationId = String(options.conversationId || '').trim();
    const presentation = normalizeHostedRegionKey(options.presentation);
    const region = normalizeHostedRegionKey(options.region);
    const explicitParentKey = String(options.parentKey || parentKey || '').trim();
    const sourceWindowId = String(options.replaceHostedWindowId || '').trim();
    if (options.replaceHostedRegion !== true) return null;
    if (!conversationId || !presentation || !region) return null;
    return (Array.isArray(windows) ? windows : []).find((win) => {
        if (!win) return false;
        if (sourceWindowId && String(win.windowId || '').trim() !== sourceWindowId) return false;
        if ((win.inTab === false) !== (inTab === false)) return false;
        if (String(win.conversationId || '').trim() !== conversationId) return false;
        if (normalizeHostedRegionKey(win.presentation) !== presentation) return false;
        if (normalizeHostedRegionKey(win.region) !== region) return false;
        return String(win.parentKey || '').trim() === explicitParentKey;
    }) || null;
};

const cloneWindowNavigationTrail = (trail = []) => {
    if (!Array.isArray(trail)) return [];
    try {
        return JSON.parse(JSON.stringify(trail));
    } catch (_) {
        return trail.map((entry) => (entry && typeof entry === 'object' ? {...entry} : entry));
    }
};

// Reopening an existing ancestor selects it; it must not move beneath its own
// descendant and detach the entire tree from the owning workspace.
export function resolveWindowParentKey(windows, windowId, requestedParent, currentParent = null) {
    const byId = new Map(windows.map(entry => [entry.windowId, entry]));
    const seen = new Set();
    let parent = requestedParent;
    while (parent) {
        if (parent === windowId || seen.has(parent)) return currentParent;
        seen.add(parent);
        parent = byId.get(parent)?.parentKey;
    }
    return requestedParent;
}

export const addWindow = (windowTitle, parentKey, windowKey, windowData, inTab = true, parameters = {}, options = {}) => {
    if(windowData) {
        parameters['windowData'] = windowData;
    }
    const explicitWindowId = String(options.windowId || '').trim();
    const identityParameterNames = Array.isArray(options.identityParameters)
        ? options.identityParameters.map((name) => String(name || '').trim()).filter(Boolean)
        : [];
    const identityParameters = identityParameterNames.length > 0
        ? Object.fromEntries(identityParameterNames.filter((name) => Object.prototype.hasOwnProperty.call(parameters, name)).map((name) => [name, parameters[name]]))
        : parameters;
    const hash = Object.keys(identityParameters).length > 0 ? generateIntHash(identityParameters) : ''
    const baseWindowId = hash ? `${windowKey}_${hash}` : windowKey;
    const hostedBaseWindowId = computeHostedConversationScopedWindowId(baseWindowId, options);
    const windowScopeId = String(options.windowScopeId || "").trim();
    const scopedBaseWindowId = windowScopeId ? `${hostedBaseWindowId}__scope:${windowScopeId}` : hostedBaseWindowId;

    // Support explicitly opening a new instance even if a window with the same
    // key/parameters already exists. When requested, compute a unique ID and
    // optionally auto-index the title (e.g., "chat <N+1>").
    const forceNewInstance = options && options.newInstance === true;
    const instanceIndex = nextInstanceIndex(activeWindows.peek(), windowKey);
    const windowId = explicitWindowId || computeWindowId(scopedBaseWindowId, forceNewInstance, instanceIndex);
    const hostOpenState = resolveWindowHostOpenState(options);


    const existingWindow = forceNewInstance
        ? undefined
        : activeWindows.value.find((win) => win.windowId === windowId)
            || resolveHostedRegionReplacementWindow(activeWindows.value.filter(win => String(win.windowScopeId || "") === windowScopeId), parentKey, inTab, options);
    parentKey = resolveWindowParentKey(activeWindows.peek(), existingWindow?.windowId || windowId, parentKey, existingWindow?.parentKey ?? null);
    let result = existingWindow
    if (!existingWindow) {
        // Optionally auto-index title for a nicer UX when multiple instances
        // of the same windowKey are opened from navigation or actions.
        const computedTitle = computeWindowTitle(windowTitle, options && options.autoIndexTitle === true, instanceIndex);

        let newWindow = {
            workspaceObject: options.workspaceObject,
            windowTitle: computedTitle,
            windowId,
            hostOpenState,
            windowScopeId: windowScopeId || undefined,
            conversationId: String(options.conversationId || '').trim() || undefined,
            parentKey,
            windowKey,
            presentation: String(options.presentation || '').trim() || undefined,
            region: String(options.region || '').trim() || undefined,
            navigation: options.navigation && typeof options.navigation === 'object' ? { ...options.navigation } : undefined,
            navigationTrail: Array.isArray(options.navigationTrail) ? cloneWindowNavigationTrail(options.navigationTrail) : undefined,
            mcpUI: options.mcpUI && typeof options.mcpUI === 'object' ? { ...options.mcpUI } : undefined,
            windowData,
            inTab,
            parameters,
            identityParameters: identityParameterNames,
            resourceRef: options.resourceRef ? {...options.resourceRef} : undefined,
            linkedRevision: options.linkedRevision,
            providerIdentity: options.providerIdentity,
            pickerDialogId: options.pickerDialogId,
            pickerParameters: options.pickerParameters,
            isModal: !!options.modal,
        };
        if (options.inlineMetadata) {
            newWindow.inlineMetadata = options.inlineMetadata;
            newWindow.inlineMetadataExplicit = true;
        }
        if (options.size) {
            newWindow.size = options.size;
        }
        if (options.x !== undefined) {
            newWindow.x = options.x;
        }
        if (options.y !== undefined) {
            newWindow.y = options.y;
        }
        if (options.footer) {
            newWindow.footer = options.footer;
        }
        if (options.workspaceSharePct !== undefined) {
            newWindow.workspaceSharePct = options.workspaceSharePct;
        }
        if (options.workspaceMinHeight !== undefined) {
            newWindow.workspaceMinHeight = options.workspaceMinHeight;
        }
        if (options.workspaceCollapsed !== undefined) {
            newWindow.workspaceCollapsed = options.workspaceCollapsed === true;
        }
        if (inTab === false) {
            floatingWindowZIndex += 1;
            newWindow.zIndex = floatingWindowZIndex;
        }
        activeWindows.value = [
            ...activeWindows.peek(),
            newWindow,
        ];
        result = newWindow;
    } else {
        const replacingSemanticWindow =
            existingWindow.windowId !== windowId
            || String(existingWindow.windowKey || '').trim() !== String(windowKey || '').trim();
        if (replacingSemanticWindow) {
            removeSignalsForKey(existingWindow.windowId);
        }
        const computedTitle = computeWindowTitle(windowTitle, options && options.autoIndexTitle === true, instanceIndex);
        const nextConversationId = String(options.conversationId || '').trim() || undefined;
        const nextPresentation = String(options.presentation || '').trim() || undefined;
        const nextRegion = String(options.region || '').trim() || undefined;
        const nextWindow = {
            ...existingWindow,
            windowId,
            windowTitle: computedTitle,
            hostOpenState,
            windowScopeId: windowScopeId || undefined,
            conversationId: nextConversationId,
            parentKey,
            windowKey,
            presentation: nextPresentation,
            region: nextRegion,
            workspaceObject: !replacingSemanticWindow && existingWindow.workspaceObject
                ? (options.workspaceObject ? { ...existingWindow.workspaceObject, ...options.workspaceObject,
                    origin: existingWindow.workspaceObject.origin || options.workspaceObject.origin,
                  } : existingWindow.workspaceObject)
                : options.workspaceObject,
            navigation: options.navigation && typeof options.navigation === 'object' ? { ...options.navigation } : undefined,
            navigationTrail: Array.isArray(options.navigationTrail)
                ? cloneWindowNavigationTrail(options.navigationTrail)
                : (!replacingSemanticWindow ? existingWindow.navigationTrail : undefined),
            mcpUI: options.mcpUI && typeof options.mcpUI === 'object' ? { ...options.mcpUI } : undefined,
            windowData,
            inTab,
            parameters,
            identityParameters: identityParameterNames,
            resourceRef: options.resourceRef ? {...options.resourceRef} : undefined,
            linkedRevision: options.linkedRevision,
            providerIdentity: options.providerIdentity,
            pickerDialogId: options.pickerDialogId,
            pickerParameters: options.pickerParameters,
            isModal: !!options.modal,
        };
        if (options.inlineMetadata !== undefined) {
            nextWindow.inlineMetadata = options.inlineMetadata;
            nextWindow.inlineMetadataExplicit = true;
        }
        if (options.size !== undefined) {
            nextWindow.size = options.size;
        }
        if (options.x !== undefined) {
            nextWindow.x = options.x;
        }
        if (options.y !== undefined) {
            nextWindow.y = options.y;
        }
        if (options.footer !== undefined) {
            nextWindow.footer = options.footer;
        }
        if (options.workspaceSharePct !== undefined) {
            nextWindow.workspaceSharePct = options.workspaceSharePct;
        }
        if (options.workspaceMinHeight !== undefined) {
            nextWindow.workspaceMinHeight = options.workspaceMinHeight;
        } else if (replacingSemanticWindow) {
            delete nextWindow.workspaceMinHeight;
        }
        if (options.workspaceCollapsed !== undefined) {
            nextWindow.workspaceCollapsed = options.workspaceCollapsed === true;
        }
        if (inTab !== false) {
            delete nextWindow.zIndex;
            nextWindow.isMinimized = false;
        } else if (existingWindow.isMinimized) {
            nextWindow.isMinimized = false;
        }
        activeWindows.value = activeWindows.value.map((win) =>
            win.windowId === existingWindow.windowId ? nextWindow : win
        );
        result = nextWindow;
    }

    if (existingWindow && existingWindow.isMinimized) {
        // Restore the minimized window
        activeWindows.value = activeWindows.value.map((w) =>
            w.windowId === existingWindow.windowId
                ? {...w, isMinimized: false}
                : w
        );
    }

    // Update selectedTabId if the window is in tab
    if (shouldAutoSelectWindow(inTab, windowId, options, activeWindows.peek())) {
        selectedTabId.value = windowId;
        selectedWindowId.value = windowId;
    } else if (inTab === false) {
        // For floating windows, bring them to front
        bringFloatingWindowToFront(windowId);
    }
    return result
};


export const removeWindow = (windowId) => {
    //console.log("removeWindow " + windowId);
    const windowToRemove = activeWindows.value.find((win) => win.windowId === windowId);

    activeWindows.value = activeWindows.value.filter(
        (win) => win.windowId !== windowId
    );
    clearWindowContext(windowId);
    removeSignalsForKey(windowId);

    if (selectedWindowId.value === windowId) {
        if (windowToRemove && windowToRemove.inTab !== false) {
            const remainingTabbedWindows = activeWindows.value.filter(win => win.inTab !== false);
            selectedWindowId.value = remainingTabbedWindows.length > 0
                ? remainingTabbedWindows[remainingTabbedWindows.length - 1].windowId
                : null;
        } else {
            const remainingWindows = activeWindows.value;
            selectedWindowId.value = remainingWindows.length > 0
                ? remainingWindows[remainingWindows.length - 1].windowId
                : null;
        }
    }

    if (windowToRemove && windowToRemove.inTab !== false) {
        // Update selectedTabId if necessary
        if (selectedTabId.value === windowId) {
            const remainingTabbedWindows = activeWindows.value.filter(win => win.inTab !== false);
            if (remainingTabbedWindows.length > 0) {
                // Set to the last opened tab
                selectedTabId.value = remainingTabbedWindows[remainingTabbedWindows.length - 1].windowId;
            } else {
                selectedTabId.value = null;
            }
        }
    }
};


export const dockWindow = (windowId) => {
    //console.log('Docking window:', windowId);
    activeWindows.value = activeWindows.value.map(win => {
        if (win.windowId === windowId) {
            return {...win, inTab: true};
        }
        return win;
    });
    selectedTabId.value = windowId;
    selectedWindowId.value = windowId;
};

export const undockWindow = (windowId) => {
    //console.log('Undocking window:', windowId);
    floatingWindowZIndex += 1;
    activeWindows.value = activeWindows.value.map(win => {
        if (win.windowId === windowId) {
            return {...win, inTab: false, zIndex: floatingWindowZIndex};
        }
        return win;
    });
};


export const bringFloatingWindowToFront = (windowId) => {
    const windows = activeWindows.value;
    floatingWindowZIndex += 1;
    activeWindows.value = windows.map(win => {
        if (win.windowId === windowId && win.inTab === false) {
            return {...win, zIndex: floatingWindowZIndex};
        } else {
            return win;
        }
    });

    selectedWindowId.value = windowId;
};
