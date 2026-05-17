import {signal} from '@preact/signals-react';

import {generateIntHash} from "../../utils/hash.js";
import { injectActions } from '../../actions/action.js';
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



// Get or create metadata signal for a unique window key
export const getMetadataSignal = (windowId) => {
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
export const getInputSignal = (sourceId) => {
    if (!inputSignals.value[sourceId]) {
        const newSignal = signal({fetch: false, refresh: false});
        inputSignals.value = {
            ...inputSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return inputSignals.value[sourceId];
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
        getDialogSignal(`${id}Dialog${dialogId}`);
    }
};




// Remove signals for a unique window key
export const removeSignalsForKey = (windowId) => {
    //console.log("removing signals for key", windowId);
    const newMetadataSignals = {...metadataSignals.value};
    delete newMetadataSignals[windowId];
    metadataSignals.value = newMetadataSignals;

    const newDataSignals = {...dataSignals.value};
    const newDataControlSignals = {...controlSignals.value};
    const newDataInputSignals = {...inputSignals.value};
    const newViewSignals = {...viewSignals.value};
    const newSelectionSignals = {...selectionSignals.value};
    const newCollectionInfoSignals = {...collectionInfoSignals.value};
    const newMetricsSignals = {...metricsSignals.value};
    const newFormSignals = {...formSignals.value};
    const newMessageSignals = {...messageSignals.value};
    const newDialogSignals = {...dialogSignals.value};
    const newFormStatusSignals = {...formStatusSignals.value};

    const newBusSignals = {...busSignals.value};
    const newDashboardFilterSignals = {...dashboardFilterSignals.value};
    const newDashboardSelectionSignals = {...dashboardSelectionSignals.value};


    for (const key in newDataSignals) {
        if (key.startsWith(windowId)) {
            delete newDataSignals[key];
            delete newDataControlSignals[key];
            delete newDataInputSignals[key];
            delete newViewSignals[key];
            delete newSelectionSignals[key];
            delete newCollectionInfoSignals[key];
            delete newMetricsSignals[key];
            delete newFormSignals[key];
            delete newMessageSignals[key];
            delete newDialogSignals[key];
            delete newFormStatusSignals[key];
        }
    }

    // Remove bus signal for this window (exact match, not startsWith)
    delete newBusSignals[windowId];
    for (const key in newDashboardFilterSignals) {
        if (key.startsWith(`${windowId}:`)) {
            delete newDashboardFilterSignals[key];
        }
    }
    for (const key in newDashboardSelectionSignals) {
        if (key.startsWith(`${windowId}:`)) {
            delete newDashboardSelectionSignals[key];
        }
    }


    dataSignals.value = newDataSignals;
    controlSignals.value = newDataControlSignals;
    inputSignals.value = newDataInputSignals;
    viewSignals.value = newViewSignals;
    selectionSignals.value = newSelectionSignals;
    collectionInfoSignals.value = newCollectionInfoSignals;
    metricsSignals.value = newMetricsSignals;
    formSignals.value = newFormSignals;
    messageSignals.value = newMessageSignals;
    dialogSignals.value = newDialogSignals;
    formStatusSignals.value = newFormStatusSignals;
    busSignals.value = newBusSignals;
    dashboardFilterSignals.value = newDashboardFilterSignals;
    dashboardSelectionSignals.value = newDashboardSelectionSignals;
};




export const activeWindows = signal([]);
export const selectedWindowId = signal(null);
export const selectedTabId = signal(null);

function restoreWindowSignalsFromSnapshot(win) {
    const windowId = String(win?.windowId || '').trim();
    if (!windowId) return;

    const inlineMetadata = win?.inlineMetadata;
    if (inlineMetadata && typeof inlineMetadata === 'object') {
        try {
            injectActions(inlineMetadata);
            getMetadataSignal(windowId).value = inlineMetadata;
        } catch (_) {}
    }

    if (win?.windowForm && typeof win.windowForm === 'object') {
        getFormSignal(`${windowId}:windowForm`).value = win.windowForm;
    }

    if (win?.viewState && typeof win.viewState === 'object') {
        getViewSignal(windowId).value = win.viewState;
    }

    const dataSources = win?.dataSources && typeof win.dataSources === 'object'
        ? Object.values(win.dataSources)
        : [];
    for (const snapshot of dataSources) {
        const dataSourceRef = String(snapshot?.dataSourceRef || '').trim();
        if (!dataSourceRef) continue;
        const dataSourceId = `${windowId}DS${dataSourceRef}`;
        if (snapshot?.input && typeof snapshot.input === 'object') {
            getInputSignal(dataSourceId).value = snapshot.input;
        }
        if (snapshot?.control && typeof snapshot.control === 'object') {
            getControlSignal(dataSourceId).value = snapshot.control;
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
        conversationId: win?.conversationId || null,
        parentKey: win?.parentKey || null,
        windowKey: win?.windowKey || '',
        presentation: win?.presentation || '',
        region: win?.region || '',
        workspaceSharePct: win?.workspaceSharePct ?? undefined,
        workspaceMinHeight: win?.workspaceMinHeight ?? undefined,
        windowData: win?.windowData || '',
        inTab: win?.inTab !== false,
        parameters: win?.parameters || {},
        isModal: !!win?.isModal,
        isMinimized: !!win?.isMinimized,
        zIndex: win?.zIndex ?? null,
        x: win?.position?.x ?? win?.x ?? undefined,
        y: win?.position?.y ?? win?.y ?? undefined,
        size: win?.size || undefined,
        inlineMetadata: win?.inlineMetadata && typeof win.inlineMetadata === 'object' ? win.inlineMetadata : undefined,
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
    if (options.replaceHostedRegion !== true) return null;
    if (!conversationId || !presentation || !region) return null;
    return (Array.isArray(windows) ? windows : []).find((win) => {
        if (!win) return false;
        if ((win.inTab === false) !== (inTab === false)) return false;
        if (String(win.conversationId || '').trim() !== conversationId) return false;
        if (normalizeHostedRegionKey(win.presentation) !== presentation) return false;
        if (normalizeHostedRegionKey(win.region) !== region) return false;
        return String(win.parentKey || '').trim() === explicitParentKey;
    }) || null;
};

export const addWindow = (windowTitle, parentKey, windowKey, windowData, inTab = true, parameters = {}, options = {}) => {
    if(windowData) {
        parameters['windowData'] = windowData;
    }
    const explicitWindowId = String(options.windowId || '').trim();
    const hash = Object.keys(parameters).length > 0 ? generateIntHash(parameters) : ''
    const baseWindowId = hash ? `${windowKey}_${hash}` : windowKey;
    const scopedBaseWindowId = computeHostedConversationScopedWindowId(baseWindowId, options);

    // Support explicitly opening a new instance even if a window with the same
    // key/parameters already exists. When requested, compute a unique ID and
    // optionally auto-index the title (e.g., "chat <N+1>").
    const forceNewInstance = options && options.newInstance === true;
    const instanceIndex = nextInstanceIndex(activeWindows.peek(), windowKey);
    const windowId = explicitWindowId || computeWindowId(scopedBaseWindowId, forceNewInstance, instanceIndex);


    const existingWindow = forceNewInstance
        ? undefined
        : activeWindows.value.find((win) => win.windowId === windowId)
            || resolveHostedRegionReplacementWindow(activeWindows.value, parentKey, inTab, options);
    let result = existingWindow
    if (!existingWindow) {
        // Optionally auto-index title for a nicer UX when multiple instances
        // of the same windowKey are opened from navigation or actions.
        const computedTitle = computeWindowTitle(windowTitle, options && options.autoIndexTitle === true, instanceIndex);

        let newWindow = {
            windowTitle: computedTitle,
            windowId,
            conversationId: String(options.conversationId || '').trim() || undefined,
            parentKey,
            windowKey,
            presentation: String(options.presentation || '').trim() || undefined,
            region: String(options.region || '').trim() || undefined,
            windowData,
            inTab,
            parameters,
            isModal: !!options.modal,
        };
        if (options.inlineMetadata) {
            newWindow.inlineMetadata = options.inlineMetadata;
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
            conversationId: nextConversationId,
            parentKey,
            windowKey,
            presentation: nextPresentation,
            region: nextRegion,
            windowData,
            inTab,
            parameters,
            isModal: !!options.modal,
        };
        if (options.inlineMetadata !== undefined) {
            nextWindow.inlineMetadata = options.inlineMetadata;
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
