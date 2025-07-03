import {useState, useEffect, useRef} from 'react';
import {Tabs, Tab, Card} from '@blueprintjs/core';
import WindowContent from './WindowContent';
import {selectedWindowId, getWindowStatusSignal, appStatusSignal} from '../core';
import {
    activeWindows,
    selectedTabId,
    removeWindow,
    bringFloatingWindowToFront,
    dockWindow,
    undockWindow,
} from '../core';

import {useSignalEffect} from '@preact/signals-react';
import {Rnd} from 'react-rnd';
import WindowControls from './WindowControls';

const WindowManager = () => {
    const [windows, setWindows] = useState(() => activeWindows.value || []);
    const [tabId, setTabId] = useState(() => selectedTabId.value || null);
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({width: 0, height: 0});
    const defaultSizePadding = 40;

    // Update windows and selected tab when signals change
    useSignalEffect(() => {
        setWindows(activeWindows.value);
        setTabId(selectedTabId.value);
    });

    // Sync global app status into the focused window whenever focus changes
    useSignalEffect(() => {
        const winId = selectedWindowId.value;
        if (!winId) return;
        const winStatus = getWindowStatusSignal(winId);
        winStatus.value = appStatusSignal.peek();
    });

    useEffect(() => {
        const removeResizeListener = () => {
            window.removeEventListener('resize', updateContainerSize);
        }
        const addRemoveListener = () => {
            window.addEventListener('resize', updateContainerSize);
        }
        const updateContainerSize = () => {
            removeResizeListener()
            if (containerRef.current) {
                const {offsetWidth, offsetHeight} = containerRef.current;
                setContainerSize({width: offsetWidth, height: offsetHeight});
            }
            addRemoveListener()
        };
        updateContainerSize();
        //
        return removeResizeListener;
    }, []);

    // Separate windows into tabbed and floating
    const tabWindows = windows.filter((win) => win.inTab !== false);
    const floatingWindows = windows.filter(
        (win) => win.inTab === false && !win.isMinimized
    );

    const handleTabChange = (newTabId) => {
        selectedTabId.value = newTabId || null;
        if (newTabId) {
            selectedWindowId.value = newTabId;
        }
    };

    const handleTabClose = (windowId, e) => {
        e.stopPropagation();
        removeWindow(windowId);
    };

    const minimizeWindow = (windowId) => {
        activeWindows.value = activeWindows.value.map((win) =>
            win.windowId === windowId && win.inTab === false
                ? {...win, isMinimized: true}
                : win
        );
    };

    const updateWindowPosition = (windowId, x, y) => {
        activeWindows.value = activeWindows.value.map((win) =>
            win.windowId === windowId
                ? {...win, x, y}
                : win
        );
    };

    const updateWindowSizeAndPosition = (windowId, width, height, x, y) => {
        // Ensure width and height are numbers
        width = parseInt(width, 10);
        height = parseInt(height, 10);
        activeWindows.value = activeWindows.value.map((win) =>
            win.windowId === windowId
                ? {...win, width, height, x, y}
                : win
        );
    };

    return (
        <div
            ref={containerRef}
            style={{height: '100%', width: '100%', position: 'relative'}}
        >
            {/* Tabs for windows in tabbed mode */}
            <Tabs
                id="window-manager-tabs"
                selectedTabId={tabId}
                onChange={handleTabChange}
                //renderActiveTabPanelOnly
                large
            >
                {tabWindows.map((win) => (
                    <Tab
                        id={win.windowId}
                        key={win.windowId}
                        style={{paddingLeft: '3px'}}
                        title={
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <WindowControls
                                    onClose={(e) => handleTabClose(win.windowId, e)}
                                    onMaximize={(e) => {
                                        e.stopPropagation();
                                        undockWindow(win.windowId);
                                    }}
                                    showMinimize={false} // Do not show minimize in tabbed mode
                                    showMaximize={true} // Show maximize (undock) in tabbed mode
                                />
                                <span style={{marginLeft: 8}}>{win.windowTitle}</span>
                            </div>
                        }
                        panel={
                            <WindowContent window={win}
                                isInTab={true}
                            />
                        }
                    />
                ))}
            </Tabs>

            {/* Floating windows */}
            {floatingWindows.map((win) => (
                <Rnd
                    key={win.windowId}
                    size={{
                        width:
                            win.width ||
                            (containerSize.width || 600) - 2 * defaultSizePadding,
                        height:
                            win.height ||
                            (containerSize.height || 400) - 2 * defaultSizePadding,
                    }}
                    position={{
                        x: win.x !== undefined ? win.x : defaultSizePadding,
                        y: win.y !== undefined ? win.y : defaultSizePadding,
                    }}


                    bounds="window"
                    onMouseDown={() => bringFloatingWindowToFront(win.windowId)}
                    onDragStop={(e, d) => {
                        updateWindowPosition(win.windowId, d.x, d.y);
                    }}


                    onResizeStop={(e, direction, ref, delta, position) => {
                        updateWindowSizeAndPosition(
                            win.windowId,
                            ref.style.width,
                            ref.style.height,
                            position.x,
                            position.y
                        );
                    }}
                >
                    <div
                        className="floating-window"
                        style={{
                            border: '1px solid #ccc',
                            background: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                            height: '100%',
                        }}
                    >
                        <div
                            className="window-header"
                            style={{
                                background: '#f0f0f0',
                                padding: '5px',
                                cursor: 'move',
                                display: 'flex',
                                justifyContent: 'flex-start',
                                alignItems: 'center',
                            }}
                        >
                            <WindowControls
                                onClose={(e) => {
                                    e.stopPropagation();
                                    removeWindow(win.windowId);
                                }}
                                onMinimize={(e) => {
                                    e.stopPropagation();
                                    minimizeWindow(win.windowId);
                                }}
                                onMaximize={(e) => {
                                    e.stopPropagation();
                                    dockWindow(win.windowId);
                                }}
                                showMinimize={true}  // Show minimize in floating mode
                                showMaximize={true}  // Show maximize (dock) in floating mode
                            />
                            <span style={{marginLeft: 8}}>{win.windowTitle}</span>
                        </div>
                        <div
                            className="window-content"
                            style={{flexGrow: 1, overflow: 'auto'}}
                        >
                            <WindowContent
                                window={win}
                                isInTab={false}
                            />
                        </div>
                    </div>
                </Rnd>
            ))}
        </div>
    );
};



export default WindowManager;
