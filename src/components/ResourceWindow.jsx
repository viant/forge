import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {Button,Callout,Spinner} from '@blueprintjs/core';
import {SettingProvider,useSetting} from '../core/context/Setting.jsx';
import WindowContent from './WindowContent.jsx';

import {resourceWindowMetadata} from '../runtime/resourceWindowMetadata.js';
export {resourceWindowMetadata} from '../runtime/resourceWindowMetadata.js';

// The host owns resource admission and the authenticated operation transport.
// This component only owns loading, context isolation and rendering.
export function ResourceWindow({uri,instanceKey=uri,parameters,hostServices,onComplete,onClose,onNavigate,onDirtyChange,disabled=false}) {
 const inherited=useSetting();
 const base=hostServices||inherited.services||{};
 const host=base.hostWindow||{};
 const explicitDirty=useRef(false),childDirty=useRef(new Map()),dialogs=useRef(new Set()),lastDirty=useRef(false);
 const callbacks=useRef({});callbacks.current={onComplete,onClose,onNavigate,onDirtyChange};
 const [initialParameters]=useState(()=>parameters||{}),[state,setState]=useState({}),[attempt,setAttempt]=useState(0);
 const mountId=useId(),windowId=instanceKey+':'+mountId;
 const publishDirty=React.useCallback(()=>{
  const value=explicitDirty.current||dialogs.current.size>0||Array.from(childDirty.current.values()).some(Boolean);
  if(lastDirty.current===value)return;lastDirty.current=value;
  if(callbacks.current.onDirtyChange)callbacks.current.onDirtyChange(value);
  else if(host.setScopeDirty)host.setScopeDirty(windowId,value);
  else host.setDirty?.(value);
 },[host.setScopeDirty,host.setDirty,windowId]);
 useEffect(()=>()=>{if(callbacks.current.onDirtyChange)callbacks.current.onDirtyChange(false);else host.setScopeDirty?.(windowId,false);},[host.setScopeDirty,windowId]);
 useEffect(()=>{let active=true;setState({});Promise.resolve().then(()=>{
  if(typeof host.loadResource!=='function')throw new Error('The host has no window resource loader.');
  return host.loadResource(uri);
 }).then(resource=>{if(active)setState({metadata:resourceWindowMetadata(resource,inherited.targetContext?.platform?inherited.targetContext:undefined)});}).catch(error=>{if(active)setState({error});});return()=>{active=false;};},[uri,host.loadResource,attempt]);
 const services=useMemo(()=>state.metadata?{...base,dataConnectorTransport:request=>{
  if(typeof host.executeResource!=='function')throw new Error('The host has no window datasource transport.');
  return host.executeResource(state.metadata,request);
 },hostWindow:{...host,parameters:initialParameters,complete:value=>callbacks.current.onComplete?.(value),close:()=>callbacks.current.onClose?.(),navigate:(...args)=>(callbacks.current.onNavigate||host.navigate)?.(...args),setDirty:value=>{explicitDirty.current=Boolean(value);publishDirty();},setScopeDirty:(key,value)=>{if(value)childDirty.current.set(key,true);else childDirty.current.delete(key);publishDirty();},setDialogOpen:(key,value)=>{if(value)dialogs.current.add(key);else dialogs.current.delete(key);publishDirty();}}}:{},[base,state.metadata,initialParameters,publishDirty]);
 if(state.error)return <Callout intent="danger" title="Unable to open this window">{state.error.message} <Button onClick={()=>setAttempt(value=>value+1)}>Retry</Button></Callout>;
 if(!state.metadata)return <Spinner aria-label="Loading window" size={24}/>;
 return <fieldset disabled={disabled} className="forge-resource-window-boundary" style={{border:0,padding:0,margin:0,minWidth:0,width:'100%'}}><SettingProvider connectorConfig={{window:{service:{uri}}}} services={services} targetContext={inherited.targetContext}><WindowContent key={windowId} window={{windowId,windowKey:state.metadata.windowKey,parameters:initialParameters}} selectedMetadata={state.metadata}/></SettingProvider></fieldset>;
}
