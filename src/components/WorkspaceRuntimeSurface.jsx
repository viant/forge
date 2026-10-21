import React,{useEffect,useRef} from 'react';
import {WorkspacePresentationProvider} from '../core/context/WorkspacePresentation.jsx';
import {RetainedWindowContent} from './WindowContentMount.jsx';

export function shouldShowWorkspaceTabs(count,visibility='auto') {
    return count>0 && visibility!=='never' && (visibility==='always' || count>1);
}
const identity=entry=>String(entry?.windowId || '').trim();
export function requestWorkspaceClose(entry,{onClose,canClose=entry=>entry.closable!==false,onRuntimeEvent}={},event) {
    event?.stopPropagation?.();
    if(!onClose || !canClose(entry))return false;
    onRuntimeEvent?.({type:'close_requested',windowId:identity(entry)});
    return onClose(identity(entry),event);
}
const label=entry=>entry?.label || entry?.windowTitle || entry?.windowKey || identity(entry);
export function workspaceRuntimeEntries(entries=[]) {
    const seen=new Set();
    return (Array.isArray(entries)?entries:[]).filter(entry=>{const id=identity(entry);if(!id || seen.has(id))return false;seen.add(id);return true;});
}
export const workspaceTabID=(id,windowId)=>`${id}-tab-${encodeURIComponent(windowId)}`;
export const workspacePanelID=(id,windowId)=>`${id}-panel-${encodeURIComponent(windowId)}`;

// The host owns selection and close admission (including dirty confirmation).
// This component owns keyboard traversal, focus, capabilities and tab semantics.
export function WorkspaceRuntimeTabs({id='workspace',entries=[],selectedId,onSelect,onClose,canClose=entry=>entry?.closable!==false,
    visibility='always',ariaLabel='Open workspaces',className='',itemClassName='',tabClassName='',renderLabel=label,renderLeading,renderTrailing,renderClose,onKeyboardSelect,onRuntimeEvent,tabIdFor=workspaceTabID,panelIdFor=workspacePanelID}) {
    const tabs=workspaceRuntimeEntries(entries);
    if(!shouldShowWorkspaceTabs(tabs.length,visibility))return null;
    const active=tabs.some(entry=>identity(entry)===selectedId)?selectedId:identity(tabs[0]);
    const select=(entry,event,keyboard=false)=>{
        if(entry.disabled===true)return false;
        if(keyboard)onKeyboardSelect?.(identity(entry));
        onRuntimeEvent?.({type:'select_requested',windowId:identity(entry),keyboard});
        return onSelect?.(identity(entry),{event,keyboard});
    };
    const close=(entry,event)=>requestWorkspaceClose(entry,{onClose,canClose,onRuntimeEvent},event);
    return <div role="tablist" aria-label={ariaLabel} className={className}>{tabs.map(entry=>{
        const windowId=identity(entry),isActive=windowId===active;
        return <span key={windowId} className={itemClassName} data-workspace-tab-id={windowId}>
            {renderLeading?.(entry,{close:event=>close(entry,event),selected:isActive})}
            <button type="button" id={tabIdFor(id,windowId)} role="tab" aria-controls={panelIdFor(id,windowId)} aria-selected={isActive} disabled={entry.disabled===true} tabIndex={isActive?0:-1}
                className={`${tabClassName}${isActive?' is-active':''}`} onClick={event=>select(entry,event)} onKeyDown={event=>{
                    if(event.key==='Delete' && onClose && canClose(entry)){event.preventDefault();close(entry,event);return;}
                    const available=tabs.filter(tab=>tab.disabled!==true),index=available.indexOf(entry);
                    const delta=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
                    if(!available.length || !delta && event.key!=='Home' && event.key!=='End')return;
                    event.preventDefault();
                    const next=available[event.key==='Home'?0:event.key==='End'?available.length-1:(index+delta+available.length)%available.length];
                    const tablist=event.currentTarget.closest('[role="tablist"]');
                    const result=select(next,event,true);
                    const focus=()=>{
                        const target=document.getElementById(tabIdFor(id,identity(next)));
                        if(target && tablist?.contains(target))target.focus();
                    };
                    if(result && typeof result.then==='function')return result.then(admitted=>{if(admitted!==false)focus();});
                    if(result!==false)focus();
                }}>{renderLabel(entry,{selected:isActive})}</button>
            {renderClose?renderClose(entry,{close:event=>close(entry,event),disabled:!canClose(entry)}):onClose?<button type="button" disabled={!canClose(entry)} aria-label={`Close ${label(entry)}`} onClick={event=>close(entry,event)}>×</button>:null}
            {renderTrailing?.(entry,{selected:isActive})}
        </span>;
    })}</div>;
}
function RuntimePanel({entry,active,id,tabIdFor,panelIdFor,className,panelProps,renderContent,presentation,onLifecycle,onRuntimeEvent}) {
    const windowId=identity(entry),callbacks=useRef({});callbacks.current={onLifecycle,onRuntimeEvent};
    useEffect(()=>{callbacks.current.onLifecycle?.(windowId,{phase:'mounted'});callbacks.current.onRuntimeEvent?.({type:'panel_mounted',windowId});return()=>{callbacks.current.onLifecycle?.(windowId,{phase:'unmounted'});callbacks.current.onRuntimeEvent?.({type:'panel_unmounted',windowId});};},[windowId]);
    useEffect(()=>{callbacks.current.onRuntimeEvent?.({type:'panel_visibility',windowId,active});},[windowId,active]);
    return <WorkspacePresentationProvider value={presentation || {label:label(entry),kind:entry.kind || 'window'}}><div {...panelProps} id={panelIdFor(id,windowId)} role="tabpanel" aria-label={label(entry)} aria-labelledby={tabIdFor(id,windowId)} hidden={!active} aria-hidden={!active} inert={!active?'':undefined} className={className}>
        <RetainedWindowContent active={active}>{renderContent(entry,{active})}</RetainedWindowContent>
    </div></WorkspacePresentationProvider>;
}
// Stable window identity, lazy first visit and retained state are shared across
// any host, including floating/docked mounts. Resource loading stays in slots.
export function WorkspaceRuntimePanels({id='workspace',entries=[],selectedId,active=true,className='',panelProps=()=>({}),getPresentation,renderContent,onLifecycle,onRuntimeEvent,tabIdFor=workspaceTabID,panelIdFor=workspacePanelID}) {
    const windows=workspaceRuntimeEntries(entries),selected=windows.some(entry=>identity(entry)===selectedId)?selectedId:identity(windows[0]);
    return windows.map(entry=><RuntimePanel key={identity(entry)} entry={entry} id={id} tabIdFor={tabIdFor} panelIdFor={panelIdFor} active={active&&identity(entry)===selected} className={className} panelProps={panelProps(entry)} presentation={getPresentation?.(entry)} renderContent={renderContent} onLifecycle={onLifecycle} onRuntimeEvent={onRuntimeEvent}/>);
}
export default function WorkspaceRuntimeSurface({children,tabProps,panelProps,className='',style}) {
    return <div className={className} style={style} data-forge-workspace-runtime="true"><WorkspaceRuntimeTabs {...tabProps}/>{children}<WorkspaceRuntimePanels {...panelProps}/></div>;
}
