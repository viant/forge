import WorkspaceRuntimeSurface from './WorkspaceRuntimeSurface.jsx';
import {registerControlActions,invalidateControlActionState,isLiveControlVisible} from '../core/ui/controlActions.js';
import {WindowContentMount, PersistentWindowContent} from './WindowContentMount.jsx';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import {Card, Alert} from '@blueprintjs/core';
import {getWindowContext} from '../core/context/registry.js';
import {windowCloseDecision, preventDirtyWindowUnload} from './windowCloseDecision.js';
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

import {Rnd} from 'react-rnd';
import WindowControls from './WindowControls';
import './WindowManager.css';
import { resolveTabWindows, resolveVisibleTabId } from './windowManagerState.js';

const WindowManager = ({renderWindowContent, isTabVisible, includeHosted = false, windowFilter, onCloseWindow, workspaceRuntime = {}}) => {
    useSignals();
    const performClose = typeof onCloseWindow === "function" ? onCloseWindow : removeWindow;
    const [pendingClose,setPendingClose]=useState(null);
    const closeWindow = windowId => {
        const decision=windowCloseDecision(getWindowContext(windowId));
        if(decision.requiresConfirmation){setPendingClose({windowId,message:decision.message});return false;}
        const result=performClose(windowId);return result && typeof result.then==='function'?result.then(()=>true):true;
    };
    useEffect(()=>{
        const beforeUnload=event=>preventDirtyWindowUnload(event,(activeWindows.peek() || []).map(win=>getWindowContext(win.windowId)));
        window.addEventListener('beforeunload',beforeUnload);
        return ()=>window.removeEventListener('beforeunload',beforeUnload);
    },[]);
    const windows = (activeWindows.value || []).filter(win => typeof windowFilter !== "function" || windowFilter(win) !== false);
    const tabId = selectedTabId.value || null;
    const containerRef = useRef(null);
    const [contentHosts,setContentHosts] = useState({});
    const registerContentHost = useCallback((id,node)=>setContentHosts(previous=>previous[id]===node ? previous : {...previous,[id]:node}),[]);
    const [containerSize, setContainerSize] = useState({width: 0, height: 0});
    const defaultSizePadding = 40;

    // Sync global app status into the focused window whenever focus changes
    useEffect(() => {
        const winId = selectedWindowId.value;
        if (!winId || !windows.some(win => win.windowId === winId)) return;
        const winStatus = getWindowStatusSignal(winId);
        winStatus.value = appStatusSignal.peek();
    }, [selectedWindowId.value]);

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
                const floats = windows.filter(w => w.inTab === false && !w.isMinimized);
                if (floats.length === 0) return;
                const top = floats.reduce((a, b) => (a.zIndex || 0) >= (b.zIndex || 0) ? a : b);
                if (top && top.windowId) closeWindow(top.windowId);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [windows]);

    // Separate windows into tabbed and floating
    const tabWindows = resolveTabWindows(windows, {includeHosted}).filter((win) => (
        typeof isTabVisible !== 'function' || isTabVisible(win) !== false
    ));
    const floatingWindows = windows.filter(
        (win) => win.inTab === false && !win.isMinimized
    );
    const visibleTabId = resolveVisibleTabId(tabWindows, tabId);

    const frameOperation = useRef(null);
    const confirmClose = () => {const id=pendingClose?.windowId;setPendingClose(null);const result=id?performClose(id):null;return result && typeof result.then==='function'?result.then(()=>({status:'closed',accepted:true})):{status:'closed',accepted:true};};
    const cancelClose = () => {setPendingClose(null);return {status:'cancelled',accepted:false};};
    frameOperation.current={pendingClose,closeWindow,confirmClose,cancelClose};
    const frameWindowIds=[...new Set([...tabWindows,...floatingWindows].map(win=>win.windowId))].sort().join('|');
    useEffect(()=>{
        const cleanups=[];
        for(const windowId of frameWindowIds.split('|').filter(Boolean)) {
            const current=()=>frameOperation.current;
            const meta={windowId,controlId:'window:close',type:'windowAction'};
            cleanups.push(registerControlActions(meta,()=>({visible:isLiveControlVisible(containerRef.current),disabled:false,readOnly:false,actions:{click:async()=>await current().closeWindow(windowId)?{status:'closed',accepted:true}:{status:'awaiting_confirmation',pendingConfirmation:true,accepted:false}}})));
            cleanups.push(registerControlActions({...meta,controlId:'window:close:confirm'},()=>({visible:current().pendingClose?.windowId===windowId&&isLiveControlVisible(containerRef.current),disabled:current().pendingClose?.windowId!==windowId,readOnly:false,actions:{click:()=>current().confirmClose()}})));
            cleanups.push(registerControlActions({...meta,controlId:'window:close:cancel'},()=>({visible:current().pendingClose?.windowId===windowId&&isLiveControlVisible(containerRef.current),disabled:current().pendingClose?.windowId!==windowId,readOnly:false,actions:{click:()=>current().cancelClose()}})));
        }
        return ()=>cleanups.forEach(cleanup=>cleanup());
    },[frameWindowIds]);
    useEffect(()=>{for(const windowId of frameWindowIds.split('|').filter(Boolean))invalidateControlActionState(windowId);},[frameWindowIds,pendingClose?.windowId]);

    const handleTabChange = (newTabId) => {
        selectedTabId.value = newTabId || null;
        if (newTabId) {
            selectedWindowId.value = newTabId;
        }
    };

    const handleTabClose = (windowId, e) => {
        e.stopPropagation();
        closeWindow(windowId);
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

    const resolveDisplayWindowTitle = (win) => {
        const explicitTitle = String(win?.windowTitle || '').trim();
        if (explicitTitle) {
            return explicitTitle;
        }
        return String(win?.windowKey || '').trim();
    };

    const renderContent = (win, isInTab) => {
        const defaultContent = <WindowContent window={{...win, fillParent: true}} isInTab={isInTab} />;
        if (typeof renderWindowContent !== 'function') {
            return defaultContent;
        }
        return renderWindowContent({window: win, isInTab, defaultContent}) ?? defaultContent;
    };

    return (
        <div
            ref={containerRef}
            style={{flex: 1, minHeight: 0, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column'}}
        >
            {/* Tabs for windows in tabbed mode */}
            <WorkspaceRuntimeSurface className="forge-window-manager-tabs" style={{flex:1,minHeight:0}}
                tabProps={{id:'window-manager-tabs',tabIdFor:(id,windowId)=>`bp6-tab-title_${id}_${windowId}`,panelIdFor:(id,windowId)=>`bp6-tab-panel_${id}_${windowId}`,entries:tabWindows,selectedId:visibleTabId,onSelect:handleTabChange,onClose:closeWindow,
                    onRuntimeEvent:workspaceRuntime.onRuntimeEvent,className:'bp6-tab-list',itemClassName:'forge-window-manager-tab',tabClassName:'bp6-tab',ariaLabel:'Open windows',
                    renderLabel:resolveDisplayWindowTitle,
                    renderLeading:(win,{close})=><WindowControls onClose={close} onMaximize={event=>{event.stopPropagation();undockWindow(win.windowId);}} showMinimize={false} showMaximize/>,
                    renderClose:()=>null}}
                panelProps={{id:'window-manager-tabs',tabIdFor:(id,windowId)=>`bp6-tab-title_${id}_${windowId}`,panelIdFor:(id,windowId)=>`bp6-tab-panel_${id}_${windowId}`,entries:tabWindows,selectedId:visibleTabId,className:'forge-window-manager-tabs__panel',
                    getPresentation:workspaceRuntime.getPresentation || (win=>({label:resolveDisplayWindowTitle(win),kind:'window'})),onLifecycle:workspaceRuntime.onLifecycle,onRuntimeEvent:workspaceRuntime.onRuntimeEvent,
                    renderContent:win=><WindowContentMount windowId={win.windowId} register={registerContentHost}/>}}/>


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
                            if (containerSize.width > 0 && containerSize.width <= 600) return containerSize.width;
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
                            if (containerSize.width > 0 && containerSize.width <= 600) return containerSize.height;
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
                            if (containerSize.width > 0 && containerSize.width <= 600) return 0;
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
                            if (containerSize.width > 0 && containerSize.width <= 600) return 0;
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
                                background: 'linear-gradient(135deg, #eef4ff 0%, #dce8fb 100%)',
                                borderBottom: '1px solid rgba(148, 163, 184, 0.28)',
                                padding: '8px 12px',
                                cursor: 'move',
                                display: 'grid',
                                gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 8,
                                alignItems: 'center',
                            }}
                        >
                            <div style={{justifySelf: 'start'}}>
                                <WindowControls
                                    onClose={(e) => {
                                        e.stopPropagation();
                                        closeWindow(win.windowId);
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
                            </div>
                            <span style={{textAlign: 'center', fontWeight: 700, color: '#1f2a44'}}>{resolveDisplayWindowTitle(win)}</span>
                            <div />
                        </div>
                        <div
                            className="window-content"
                            style={{display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, minWidth: 0, overflow: 'hidden'}}
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
                            {<WindowContentMount windowId={win.windowId} register={registerContentHost}/>}
                        </div>
                    </div>
                </Rnd>
            ))}
            <Alert isOpen={!!pendingClose} intent="warning" confirmButtonText="Discard and close" cancelButtonText="Keep editing" onCancel={cancelClose} onConfirm={confirmClose}>{pendingClose?.message}</Alert>
            {windows.map(win=><PersistentWindowContent key={win.windowId} host={contentHosts[win.windowId]}>{renderContent(win,win.inTab !== false)}</PersistentWindowContent>)}
        </div>
    );
};



export default WindowManager;
