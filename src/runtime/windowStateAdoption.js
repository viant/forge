import {activeWindows, findMetadataSignal, getViewSignal, getFormSignal, getInputSignal, getSelectionSignal, getFormStatusSignal, getControlSignal, getCollectionSignal, protectedWindowEpoch} from '../core/store/signals.js';
import {getWindowContext} from '../core/context/registry.js';
import {canonicalSelectionBinding} from './canonicalDelivery.js';
import {resolveSelector, setSelector} from '../utils/selector.js';
import {draftSnapshot, retainDraftBaseline} from '../components/primitives/draftFormModel.js';

// Local, single-use window state. Host-defined association keys are opaque:
// the host supplies their meaning, while Forge enforces fresh admission and
// unchanged resource/owner scope. Never serialized into a snapshot or tool.
const pending = new Map();
const clone = value => structuredClone(value);
const plain = value => value && Object.prototype.toString.call(value) === '[object Object]';
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const windowScope = window => stable({windowId:window?.windowId,windowKey:window?.windowKey,parameters:window?.parameters,resource:window?.resource,resourceRef:window?.resourceRef,resourceTarget:window?.resourceTarget,selectionBinding:window?.selectionBinding});
// Normal admission validates signatures and leases. Compare the selected target
// and dependency identities independently of those renewable wire proofs.
function targetIdentity(value) {
  if(Array.isArray(value))return value.map(targetIdentity);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['selectionToken','token','validUntil','expiresAt','issuedAt'].includes(key)).map(([key,item])=>[key,targetIdentity(item)]));
}
function admissionScope(metadata) {
  const binding = canonicalSelectionBinding(metadata);
  if (binding) {
    const {token, expiresAt, issuedAt, ...identity} = binding;
    const snapshot = metadata.authorizationSnapshot;
    return stable({kind:'canonical',identity,resource:metadata.resource,target:targetIdentity(metadata.resourceTarget),authority:snapshot ? {
      version:snapshot.authorizationVersion,principal:snapshot.principal,account:snapshot.account,
      resource:snapshot.resource,globalCapabilities:snapshot.globalCapabilities,
    } : null});
  }
  const snapshot = metadata?.authorizationSnapshot;
  const resource = metadata?.resource;
  const localOwner=metadata?.localStateOwner;
  if(resource?.providerIdentity&&resource?.uri&&resource?.kind&&resource?.contentFingerprint
    && resource.authorityBinding==='public-local-definition'&&localOwner?.binding
    && Number.isFinite(Date.parse(localOwner.validUntil))) {
    const {validUntil,...identity}=resource;
    return stable({kind:'local-state-owner',identity,target:targetIdentity(metadata.resourceTarget),owner:localOwner.binding,authority:snapshot?{
      version:snapshot.authorizationVersion,principal:snapshot.principal,account:snapshot.account,
      resource:snapshot.resource,globalCapabilities:snapshot.globalCapabilities,
    }:null});
  }
  // The normal resolved-resource transport carries its verified actor/account/
  // authority revision in an opaque server-derived binding, rather than the
  // optional selected-delivery binding or legacy principal/resource IDs. This
  // comparison only gates local state restoration AFTER another normal GET and
  // permission admission; it never grants access or supplies actor authority.
  if (resource?.providerIdentity && resource?.uri && resource?.kind && resource?.contentFingerprint
    && resource.authorityBinding && resource.authorityBinding !== 'public-local-definition'
    && Number.isFinite(Date.parse(resource.validUntil))) {
    // An expired held lease may identify local intent. Only a fresh live lease
    // after normal admission can authorize restoration below.
    const {validUntil, ...identity} = resource;
    return stable({kind:'resolved-resource',identity,target:targetIdentity(metadata.resourceTarget),authority:snapshot ? {
      version:snapshot.authorizationVersion,principal:snapshot.principal,account:snapshot.account,
      resource:snapshot.resource,globalCapabilities:snapshot.globalCapabilities,
    } : null});
  }
  if (!snapshot?.principal?.id || !snapshot?.resource?.id) return null;
  return stable({kind:'permission',target:targetIdentity(metadata.resourceTarget),principal:snapshot.principal,account:snapshot.account,resource:snapshot.resource,version:snapshot.authorizationVersion});
}
function diagnose(record, code) {
  if (typeof record?.onDiagnostic !== 'function' || record.diagnosticCount >= 24) return;
  record.diagnosticCount++;
  try {const result=record.onDiagnostic(code);if(result&&typeof result.catch==='function')result.catch(()=>{});} catch {}
}
function end(record, restored = false, reason = 'restore.cancelled') {
  if (pending.get(record.id) !== record) return;
  diagnose(record, restored ? 'restore.completed' : reason);
  pending.delete(record.id);
  clearTimeout(record.timer);
  record.stops?.forEach(stop => stop());
  record.resolve(restored);
}
const contextKey=(read,entry)=>{
 try {const key=read(entry);return key==null?'':typeof key==='string'?key:null;} catch (_) {return null;}
};
const live = record => {
  const entry = activeWindows.peek().find(window => window.windowId === record.id);
  return entry && windowScope(entry) === record.scope && (!record.to || contextKey(record.getContextKey,entry) === record.to);
};
function rowKey(row, fields) {
  if (!row || !fields.length) return null;
  const values = fields.map(field => resolveSelector(row, field));
  return values.some(value => value == null) ? null : stable(values);
}
function changedFields(form, baseline) {
  const result = {};
  for (const [key, value] of Object.entries(form || {})) if (stable(value) !== stable(baseline?.[key])) {
    result[key] = plain(value) && plain(baseline?.[key])
      ? changedFields(value,baseline[key]) : clone(value);
  }
  return result;
}
function applyDraftPatch(base, patch) {
  const result={...base};
  for (const [key,value] of Object.entries(patch)) result[key]=plain(value)
    ? applyDraftPatch(base?.[key] || {},value) : clone(value);
  return result;
}
function editableWindowFields(metadata, form) {
  const result = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.scope === 'windowForm' && !node.readOnly && !node.properties?.readOnly && !node.disabled && !node.properties?.disabled && !node.sensitive && !node.secret
      && /^(text|textarea|number|numeric|select|multiselect|checkbox|radio|switch|slider|date|daterange|filterchips)$/i.test(node.type || '')) {
      const path = node.bindingPath || node.dataField || node.id;
      if (path && !/password|secret|token|credential|authorization/i.test(path)) result.push([path, clone(resolveSelector(form, path))]);
    }
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
  };
  visit(metadata.view);
  return result;
}

export function captureWindowStateAdoption(windowId, {getContextKey,onDiagnostic} = {}) {
  const diagnostic={getContextKey,onDiagnostic,diagnosticCount:0};
  if(typeof getContextKey!=='function'){diagnose(diagnostic,'capture.context_unavailable');return null;}
  try {return captureAdoption(windowId,diagnostic);} catch(error) {
    diagnose(diagnostic,error?.name==='DataCloneError'?'capture.clone_failure':'capture.serialization_failure');
    return null;
  }
}
function captureAdoption(windowId, diagnostic) {
  const entry = activeWindows.peek().find(window => window.windowId === windowId);
  const metadata = findMetadataSignal(windowId)?.peek();
  const scope = admissionScope(metadata);
  const from=entry?contextKey(diagnostic.getContextKey,entry):null;
  if (!entry || from===null || !scope) {
    const resource=metadata?.resource;
    const reason=!entry?'capture.window_missing':from===null?'capture.context_unavailable':!resource?'capture.resource_missing'
      :!resource.providerIdentity||!resource.uri||!resource.kind||!resource.contentFingerprint||!resource.authorityBinding?'capture.resource_incomplete'
      :resource.authorityBinding==='public-local-definition'?'capture.public_resource'
      :!Number.isFinite(Date.parse(resource.validUntil))?'capture.lease_invalid':'capture.admission_unavailable';
    diagnose(diagnostic,reason);return null;
  }
  if (pending.has(windowId)) end(pending.get(windowId));
  let resolve;
  const done = new Promise(complete => { resolve = complete; });
  const record = {...diagnostic,resourceLeaseRequired:JSON.parse(scope).kind==='resolved-resource',ownerLeaseRequired:JSON.parse(scope).kind==='local-state-owner',id:windowId,scope:windowScope(entry),authority:scope,resolve,done,from,to:'',stops:[],view:clone(getViewSignal(windowId).peek()),
    windowFields:editableWindowFields(metadata,getFormSignal(`${windowId}:windowForm`).peek()),sources:[]};
  for (const [ref, definition] of Object.entries(metadata.dataSource || {})) {
    const id = `${windowId}DS${ref}`, selected = getSelectionSignal(id).peek(), form = getFormSignal(id).peek();
    const fields = (definition.uniqueKey || []).map(key => typeof key === 'string' ? key : key.field).filter(Boolean);
    if (!fields.length && selected?.selected?.id != null) fields.push('id');
    const selection = [selected?.selected, ...(selected?.selection || [])].map(row => rowKey(row?.selected || row, fields)).filter(Boolean);
    const input = getInputSignal(id).peek() || {};
    const choices = Object.fromEntries(['parameters','filter','sort','page','offset','paging','filterSet','activeFilter'].filter(key => input[key] !== undefined).map(key => [key,clone(input[key])]));
    const dirty = getFormStatusSignal(id).peek()?.dirty === true;
    record.sources.push({ref,id,fields,selection,multi:Array.isArray(selected?.selection),choices,
      dirty,patch:dirty ? changedFields(form,selected?.selected) : null,deferred:definition.autoFetch === false});
  }
  record.timer = setTimeout(() => end(record,false,'restore.expired'), 30000);
  pending.set(windowId,record);
  diagnose(record,'capture.ready');
  record.stops.push(activeWindows.subscribe(windows => {
    const current = windows.find(window => window.windowId === windowId);
    if (!current || windowScope(current) !== record.scope || (contextKey(record.getContextKey,current)!==record.from && (!record.to||contextKey(record.getContextKey,current)!==record.to))) end(record,false,'restore.window_scope_changed');
  }));
  return {commit(destinationKey) {if (typeof destinationKey!=='string'||!destinationKey||pending.get(windowId)!==record||(record.to&&record.to!==destinationKey))return false;record.to=destinationKey;diagnose(record,'capture.committed');return true;},cancel() {end(record);}};
}

export function beginWindowStateAdoption(window, metadata) {
  const record = pending.get(window?.windowId);
  if (!record || record.started || !record.to || contextKey(record.getContextKey,window) !== record.to || !live(record)
    || admissionScope(metadata) !== record.authority) {if(record)diagnose(record,!live(record)?'begin.window_scope_mismatch':admissionScope(metadata)!==record.authority?'begin.admission_mismatch':'begin.not_ready');return null;}
  record.started = true;
  diagnose(record,'begin.ready');
  return record;
}
export function windowStateAdoptionCleared(record) {
  if (record) {record.epoch = protectedWindowEpoch(record.id);diagnose(record,'begin.cleared');}
}
export function rejectWindowStateAdoption(record) {if (record) end(record);}

export function completeWindowStateAdoption(record, freshMetadata) {
  if (!record || pending.get(record.id) !== record || !live(record)
    || record.epoch !== protectedWindowEpoch(record.id) || admissionScope(freshMetadata) !== record.authority
    || (record.resourceLeaseRequired && !(Date.parse(freshMetadata?.resource?.validUntil)>Date.now()))
    || (record.ownerLeaseRequired && !(Date.parse(freshMetadata?.localStateOwner?.validUntil)>Date.now()))) {
    if(record)diagnose(record,record.ownerLeaseRequired&&!(Date.parse(freshMetadata?.localStateOwner?.validUntil)>Date.now())?'admission.owner_lease_invalid':record.resourceLeaseRequired&&!(Date.parse(freshMetadata?.resource?.validUntil)>Date.now())?'admission.lease_invalid':!live(record)?'admission.window_scope_mismatch':record.epoch!==protectedWindowEpoch(record.id)?'admission.generation_mismatch':'admission.authority_mismatch');
    rejectWindowStateAdoption(record);return false;
  }
  // Fresh admission has succeeded. Restore navigation/input choices before
  // mounting sources; never replay fetch, refresh, invocation or mutation flags.
  diagnose(record,'admission.accepted');
  getViewSignal(record.id).value = record.view;
  const windowForm = getFormSignal(`${record.id}:windowForm`);
  let next = windowForm.peek();
  for (const [path,value] of record.windowFields) next = setSelector(next,path,value);
  windowForm.value = next;
  for (const source of record.sources) getInputSignal(source.id).value = {...getInputSignal(source.id).peek(),...source.choices,fetch:false,refresh:false};
  const waiting = new Set(record.sources.filter(source => source.dirty || source.selection.length));
  let scheduled = false;
  const attempt = () => {
    scheduled=false;
    if (pending.get(record.id) !== record) return;
    if (!live(record) || record.epoch !== protectedWindowEpoch(record.id)) return end(record);
    for (const source of waiting) {
      const control = getControlSignal(source.id).peek() || {};
      if (control.error) {waiting.delete(source);continue;}
      const context = getWindowContext(record.id)?.Context?.(source.ref), handler = context?.handlers?.dataSource;
      if (!handler || control.loading || (control.loaded !== true && !source.deferred)) continue;
      const rows = getCollectionSignal(source.id).peek() || [];
      if (getFormStatusSignal(source.id).peek()?.dirty === true) {waiting.delete(source);continue;}
      const matched = rows.filter(row => source.selection.includes(rowKey(row,source.fields)));
      if (source.selection.length && !matched.length) {
        if (control.loaded === true) waiting.delete(source);
        continue;
      }
      if (matched.length) handler.setSelected(source.multi ? {selection:matched} : {selected:matched[0],rowIndex:rows.indexOf(matched[0])});
      // A newer user edit always wins. Patch over the fresh server baseline so
      // Reset/Save retain the normal model and complete write envelope.
      const patch = source.newerPatch ? applyDraftPatch(source.patch || {},source.newerPatch) : source.patch;
      if (patch && getFormStatusSignal(source.id).peek()?.dirty !== true) {
        const form = getFormSignal(source.id);
        retainDraftBaseline(form,draftSnapshot(form.peek()),getFormStatusSignal(source.id).peek()?.version);
        handler.setEditedFormData({values:applyDraftPatch(form.peek(),patch)});
      }
      waiting.delete(source);
    }
    if (!waiting.size) end(record,true);
  };
  const schedule = () => {if (!scheduled) {scheduled=true;queueMicrotask(attempt);}};
  record.stops.push(activeWindows.subscribe(schedule));
  for (const source of waiting) {
    const observeEdit = () => {
      if (getControlSignal(source.id).peek()?.loaded !== true && getFormStatusSignal(source.id).peek()?.dirty === true) {
        source.newerPatch = changedFields(getFormSignal(source.id).peek(),getSelectionSignal(source.id).peek()?.selected);
      }
      schedule();
    };
    record.stops.push(getControlSignal(source.id).subscribe(schedule),getCollectionSignal(source.id).subscribe(schedule));
    record.stops.push(getFormSignal(source.id).subscribe(observeEdit),getFormStatusSignal(source.id).subscribe(observeEdit));
  }
  schedule();
  return true;
}

export async function waitForWindowStateAdoption(windowId, timeoutMs = 15000) {
  const record = pending.get(windowId);
  if (!record) return false;
  let timer;
  try {return await Promise.race([record.done,new Promise(resolve => {timer=setTimeout(()=>resolve(false),timeoutMs);})]);}
  finally {clearTimeout(timer);}
}
