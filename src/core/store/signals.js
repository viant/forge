import {signal} from '@preact/signals-react';

import {generateIntHash} from "../../utils/hash.js";
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


// Get or create data signal for a unique window key
export const getViewSignal = (sourceId) => {
    //console.log("getViewSignal for key", sourceId);
    if (!viewSignals.value[sourceId]) {
        const newSignal = signal([]);
        viewSignals.value = {
            ...viewSignals.peek(),
            [sourceId]: newSignal,
        };
    }
    return viewSignals.value[sourceId];
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

    const newBusSignals = {...busSignals.value};


    for (const key in newDataSignals) {
        if (key.startsWith(windowId)) {
            delete newDataSignals[key];
            delete controlSignals[key];
            delete inputSignals[key];
            delete viewSignals[key];
        }
    }

    // Remove bus signal for this window (exact match, not startsWith)
    delete newBusSignals[windowId];


    dataSignals.value = newDataSignals;
    controlSignals.value = newDataControlSignals;
    inputSignals.value = newDataInputSignals;
    busSignals.value = newBusSignals;
};




export const activeWindows = signal([]);
export const selectedWindowId = signal(null);
export const selectedTabId = signal(null);




let floatingWindowZIndex = 10;
export const addWindow = (windowTitle, parentKey, windowKey, windowData, inTab = true, parameters = {}, options = {}) => {
    if(windowData) {
        parameters['windowData'] = windowData;
    }
    const hash = Object.keys(parameters).length > 0 ? generateIntHash(parameters) : ''
    const windowId = hash ? `${windowKey}_${hash}`:windowKey;


    const existingWindow = activeWindows.value.find(
        (win) => win.windowId === windowId
    );
    let result = existingWindow
    if (!existingWindow) {
        let newWindow = {windowTitle, windowId, parentKey, windowKey, windowData, inTab, parameters, isModal: !!options.modal};
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
        if (inTab === false) {
            floatingWindowZIndex += 1;
            newWindow.zIndex = floatingWindowZIndex;
        }
        activeWindows.value = [
            ...activeWindows.peek(),
            newWindow,
        ];
        result = newWindow;
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
    if (inTab !== false) {
        selectedTabId.value = windowId;
        selectedWindowId.value = windowId;
    } else {
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
