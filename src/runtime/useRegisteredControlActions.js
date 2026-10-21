import {useEffect,useRef} from 'react';
import {registerControlActions,invalidateControlActionState} from '../core/ui/controlActions.js';
export function useRegisteredControlActions(meta,provider,revisionState='',readProvider=provider) {
  const current=useRef(provider);current.current=provider;
  const passive=useRef(readProvider);passive.current=readProvider;
  useEffect(()=>{
    if(!meta?.windowId || !meta?.controlId)return;
    return registerControlActions(meta,()=>current.current(),()=>passive.current());
  },[meta?.windowId,meta?.dataSourceRef,meta?.controlId]);
  useEffect(()=>{if(meta?.windowId)invalidateControlActionState(meta.windowId);},[meta?.windowId,revisionState]);
}
