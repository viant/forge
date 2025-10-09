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

    // Global ESC handler: closes the top-most floating window
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                const floats = activeWindows.value.filter(w => w.inTab === false && !w.isMinimized);
                if (floats.length === 0) return;
                const top = floats.reduce((a, b) => (a.zIndex || 0) >= (b.zIndex || 0) ? a : b);
                if (top && top.windowId) removeWindow(top.windowId);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [windows]);

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
            {/* Modal backdrop: render under the top-most modal floating window */}
            {(() => {
                const modals = floatingWindows.filter(w => w.isModal);
                if (modals.length === 0) return null;
                const top = modals.reduce((a, b) => (a.zIndex || 0) >= (b.zIndex || 0) ? a : b);
                const z = (top.zIndex || 10) - 1;
                return (
                    <div
                        key={`backdrop-${top.windowId}`}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: z, pointerEvents: 'auto' }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    />
                );
            })()}

            {floatingWindows.map((win) => (
                <Rnd
                    key={win.windowId}
                    style={{ zIndex: win.zIndex || 10 }}
                    size={{
                        width: (() => {
                            if (typeof win.width === 'number') return win.width;
                            const s = win.size && win.size.width;
                            if (typeof s === 'string' && s.endsWith('%')) {
                                const pct = Math.max(0, Math.min(100, parseFloat(s)));
                                return Math.floor(((containerSize.width || 600) * pct) / 100);
                            }
                            if (typeof s === 'string' && s.endsWith('px')) return parseInt(s, 10);
                            if (typeof s === 'number') return s;
                            // default: half of container width
                            return Math.floor(((containerSize.width || 600) * 0.5));
                        })(),
                        height: (() => {
                            if (typeof win.height === 'number') return win.height;
                            const s = win.size && win.size.height;
                            if (typeof s === 'string' && s.endsWith('%')) {
                                const pct = Math.max(0, Math.min(100, parseFloat(s)));
                                return Math.floor(((containerSize.height || 400) * pct) / 100);
                            }
                            if (typeof s === 'string' && s.endsWith('px')) return parseInt(s, 10);
                            if (typeof s === 'number') return s;
                            // default: half of container height
                            return Math.floor(((containerSize.height || 400) * 0.5));
                        })(),
                    }}
                    position={{
                        x: (() => {
                            if (win.x !== undefined) {
                                if (typeof win.x === 'string' && win.x.endsWith('%')) {
                                    const pct = Math.max(0, Math.min(100, parseFloat(win.x)));
                                    return Math.floor(((containerSize.width || 600) * pct) / 100);
                                }
                                return win.x;
                            }
                            // compute width same as above
                            let w;
                            const s = win.size && win.size.width;
                            if (typeof win.width === 'number') w = win.width;
                            else if (typeof s === 'string' && s.endsWith('%')) {
                                const pct = Math.max(0, Math.min(100, parseFloat(s)));
                                w = Math.floor(((containerSize.width || 600) * pct) / 100);
                            } else if (typeof s === 'string' && s.endsWith('px')) {
                                w = parseInt(s, 10);
                            } else if (typeof s === 'number') {
                                w = s;
                            } else {
                                w = Math.floor(((containerSize.width || 600) * 0.5));
                            }
                            const x = Math.max(0, Math.floor(((containerSize.width || 600) - w) / 2));
                            return x;
                        })(),
                        y: (() => {
                            if (win.y !== undefined) {
                                if (typeof win.y === 'string' && win.y.endsWith('%')) {
                                    const pct = Math.max(0, Math.min(100, parseFloat(win.y)));
                                    return Math.floor(((containerSize.height || 400) * pct) / 100);
                                }
                                return win.y;
                            }
                            // compute height same as above
                            let h;
                            const s = win.size && win.size.height;
                            if (typeof win.height === 'number') h = win.height;
                            else if (typeof s === 'string' && s.endsWith('%')) {
                                const pct = Math.max(0, Math.min(100, parseFloat(s)));
                                h = Math.floor(((containerSize.height || 400) * pct) / 100);
                            } else if (typeof s === 'string' && s.endsWith('px')) {
                                h = parseInt(s, 10);
                            } else if (typeof s === 'number') {
                                h = s;
                            } else {
                                h = Math.floor(((containerSize.height || 400) * 0.5));
                            }
                            const y = Math.max(0, Math.floor(((containerSize.height || 400) - h) / 2));
                            return y;
                        })(),
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
                            outline: win.isModal ? '2px solid #2684FF33' : undefined,
                        }}
                        data-window-id={win.windowId}
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
                                showMinimize={!win.isModal}
                                showMaximize={!win.isModal}
                            />
                            <span style={{marginLeft: 8}}>{win.windowTitle}</span>
                        </div>
                        <div
                            className="window-content"
                            style={{flexGrow: 1, overflow: 'auto'}}
                            onKeyDown={(e) => {
                                if (!win.isModal) return;
                                if (e.key !== 'Tab') return;
                                // Focus trap: keep focus within this floating window
                                const root = e.currentTarget.closest('.floating-window');
                                if (!root) return;
                                const focusables = root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
                                const list = Array.prototype.slice.call(focusables).filter(el => el.offsetParent !== null);
                                if (list.length === 0) { e.preventDefault(); return; }
                                const idx = list.indexOf(document.activeElement);
                                let nextIdx = idx;
                                if (e.shiftKey) {
                                    nextIdx = idx <= 0 ? list.length - 1 : idx - 1;
                                } else {
                                    nextIdx = idx === -1 || idx >= list.length - 1 ? 0 : idx + 1;
                                }
                                e.preventDefault();
                                try { list[nextIdx].focus(); } catch(_) {}
                            }}
                            tabIndex={win.isModal ? 0 : undefined}
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
