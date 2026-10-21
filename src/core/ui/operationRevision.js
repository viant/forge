import {activeWindows,getMetadataSignal,getInputSignal,getFormSignal,getSelectionSignal,getCollectionSignal,getControlSignal,getViewSignal,getFormStatusSignal,getDialogSignal} from '../store/signals.js';
import {getOperationRegistryEpoch} from './controlActions.js';
const secret=/password|passwd|secret|token|credential|authorization|cookie|apikey|privatekey|localStateOwner|authorityBinding|executionProof|dependencyPins/i;
// Only the hash leaves this helper. Sensitive fields are excluded entirely.
function safe(value,seen=new WeakSet(),sensitive=new Set()) {
  if(value instanceof Date)return Number.isFinite(value.getTime())?value.toISOString():null;
  if(typeof value==='bigint')return value.toString();
  if(typeof value==='string' && /^(?:Bearer\s|Basic\s|eyJ[A-Za-z0-9_-]+\.)/i.test(value))return '[redacted]';
  if(value==null || ['string','boolean','number'].includes(typeof value))return value;
  if(typeof value!=='object')return null;
  if(seen.has(value))return null;seen.add(value);
  if(Array.isArray(value))return value.map(item=>safe(item,seen,sensitive));
  return Object.fromEntries(Object.keys(value).sort().filter(key=>!secret.test(key) && !sensitive.has(key)).map(key=>[key,safe(value[key],seen,sensitive)]));
}
const revisionCache = new Map();
const sensitivityCache = new WeakMap();
activeWindows.subscribe(windows=>{const active=new Set((windows || []).map(window=>window.windowId));for(const key of revisionCache.keys())if(!active.has(key))revisionCache.delete(key);});
const objectIdentities=new WeakMap();let nextObjectIdentity=0;
const objectIdentity=value=>{if(!objectIdentities.has(value))objectIdentities.set(value,++nextObjectIdentity);return objectIdentities.get(value);};
function collectionStructure(value,sensitive) {
  if(!Array.isArray(value))return value;
  return JSON.stringify(value.map(row=>row && typeof row==='object'?[objectIdentity(row),Object.keys(row).sort().filter(key=>!secret.test(key)&&!sensitive.has(key)).map(key=>[key,row[key]&&typeof row[key]==='object'?objectIdentity(row[key]):safe(row[key])])]:safe(row)));
}
export function getOperationRevision(windowId) {
  const window=(activeWindows.peek()||[]).find(item=>item.windowId===windowId);
  if(!window)throw new Error(`window not found: ${windowId}`);
  const metadata=getMetadataSignal(windowId).peek() || {};
  const cachedSensitivity=sensitivityCache.get(metadata);
  const sensitive=cachedSensitivity || new Set(),seen=new WeakSet();
  const visit=node=>{if(!node || typeof node!=='object' || seen.has(node))return;seen.add(node);
    if(node.sensitive===true || node.properties?.sensitive===true || /password/i.test(`${node.widget || ''} ${node.type || ''} ${node.properties?.type || ''} ${node.properties?.inputType || ''}`)) {
      for(const name of [node.dataField,node.bindingPath,node.id])if(typeof name==='string')sensitive.add(name.split('.').at(-1));
    }
    for(const value of Object.values(node))visit(value);
  };if(!cachedSensitivity){visit(metadata);sensitivityCache.set(metadata,sensitive);}
  // Small mutable form/input snapshots are compared by value, including in-place
  // edits; large collection and definition payloads retain identity-based reuse.
  const small = value => JSON.stringify(safe(value,new WeakSet(),sensitive));
  const refs = [window, metadata, getOperationRegistryEpoch(windowId), small(getViewSignal(windowId).peek()), small(getFormSignal(`${windowId}:windowForm`).peek())];
  const sourceRefs = Object.keys(metadata.dataSource || {}).sort();
  for(const ref of sourceRefs) {
    const id=`${windowId}DS${ref}`;
    refs.push(small(getFormSignal(id).peek()),small(getInputSignal(id).peek()),small(getSelectionSignal(id,{}).peek()),getCollectionSignal(id).peek(),collectionStructure(getCollectionSignal(id).peek(),sensitive),small(getControlSignal(id).peek()),small(getFormStatusSignal(id).peek()));
  }
  for(const dialog of metadata.dialogs || [])if(dialog?.id)refs.push(small(getDialogSignal(`${windowId}Dialog${dialog.id}`).peek()));
  const cached=revisionCache.get(windowId);
  if(cached && refs.length===cached.refs.length && refs.every((value,index)=>Object.is(value,cached.refs[index])))return cached.revision;
  const state=refs.map(value=>safe(value,new WeakSet(),sensitive));
  let revision=2166136261;for(const char of JSON.stringify(state))revision=Math.imul(revision^char.charCodeAt(0),16777619)>>>0;
  revisionCache.set(windowId,{refs,revision});
  return revision;
}
export function assertOperationTarget(params) {
  const window=(activeWindows.peek()||[]).find(item=>item.windowId===params.windowId);
  if(!window)throw new Error(`window not found: ${params.windowId}`);
  if(params.conversationId && params.conversationId!==window.conversationId)throw new Error('window is outside the current conversation');
  if(params.resourceTarget && JSON.stringify(safe(params.resourceTarget))!==JSON.stringify(safe(window.resourceTarget)))throw new Error('pinned window target does not match');
  const revision=getOperationRevision(params.windowId);
  if(params.expectedRevision!=null && params.expectedRevision!==revision)throw new Error('stale UI operation revision; read current UI state before retrying');
  return revision;
}
