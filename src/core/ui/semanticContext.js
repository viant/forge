// Advisory current UI state. Never include forms, rows, dialog arguments or
// credential values. Hosts consume this contract through the existing snapshot.
const secret = value => /password|passwd|secret|token|credential|authorization|cookie|apikey|privatekey|accesskey|signingkey|sessionid|csrf|authheader|authz|localstateowner|authoritybinding|selectiontoken|executionproof|dependencypins|resourcetoken|targettoken/i.test(String(value || '').replace(/[^a-z0-9]/gi, ''));
const credentialValue = value => {
 if (/\b(?:basic|bearer)\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i.test(value)) return true;
 try {const parsed=new URL(value,'https://ui.invalid');if(parsed.password)return true;for(const key of [...parsed.searchParams.keys(),...new URLSearchParams(parsed.hash.slice(1)).keys()])if(secret(key)||key.toLowerCase()==='key')return true;}catch{}
 return false;
};
const text = value => typeof value === 'string' && value.length <= 128 && !credentialValue(value) ? value : null;
const scalar = value => typeof value === 'string' ? text(value) : typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value) ? value : null;
const safeValue = value => Array.isArray(value) ? value.slice(0, 8).map(scalar).filter(value => value !== null) : scalar(value);
const pairs = value => Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).sort(([a], [b]) => a.localeCompare(b));
export function buildSemanticUIContext(window = {}, {focusedDataSourceRef = window.metadata?.view?.dataSourceRef} = {}) {
 const context = {version: 1, tabs: [], sources: [], dialogs: []};
 for (const [containerId, tabId] of pairs(window.viewState?.tabs).slice(0, 12)) {
  if (text(containerId) && text(tabId)) context.tabs.push({containerId, tabId});
 }
 const controls = Array.isArray(window.metadata?.view?.controls) ? window.metadata.view.controls : [];
 const priority = ([ref,source]) => ref === focusedDataSourceRef ? -1 : source.formStatus?.dirty === true ? 0
  : source.selection?.selected || source.selection?.selection?.length ? 1 : Object.keys(source.filter || source.input?.filter || {}).length ? 2 : source.control?.loaded ? 3 : 4;
 for (const [dataSourceRef, source] of pairs(window.dataSources).filter(([,source])=>source && typeof source === 'object').sort((a,b)=>priority(a)-priority(b)).slice(0, 12)) {
  if (!text(dataSourceRef) || secret(dataSourceRef)) continue;
  const state = {dataSourceRef, selectedIds: []};
  const identityFields = (Array.isArray(source.identityFields) ? source.identityFields : []).filter(field => text(field) && !secret(field)).slice(0, 8);
  const selected = source.selection?.selection || (source.selection?.selected ? [source.selection.selected] : []);
  for (const row of Array.isArray(selected) ? selected.slice(0, 12) : []) {
   const id = scalar(row?.id ?? row?.ID ?? row?.Id);
   if (id !== null && !state.selectedIds.includes(id)) state.selectedIds.push(id);
   if (identityFields.length) {
    const identity = Object.fromEntries(identityFields.flatMap(field => {const value=scalar(row?.[field]);return value===null?[]:[[field,value]];}));
    if (Object.keys(identity).length===identityFields.length) (state.selectedIdentities ||= []).push(identity);
   }
  }
  const sensitiveFields = new Set(controls.filter(control => control.dataSourceRef === dataSourceRef && (control.sensitive === true || secret(control.type) || secret(control.id) || secret(control.dataField))).map(control => control.dataField || control.bindingPath || control.id));
  const filters = {};
  for (const [key, value] of pairs(source.filter || source.input?.filter).slice(0, 12)) {
   if (!text(key) || secret(key) || sensitiveFields.has(key)) continue;
   const safe = safeValue(value); if (safe !== null) filters[key] = safe;
  }
  if (Object.keys(filters).length) state.filters = filters;
  const sort = (Array.isArray(source.input?.sort) ? source.input.sort : []).slice(0, 8).flatMap(entry => {
   const field = text(entry?.columnId || entry?.field), direction = entry?.direction;
   return field && !secret(field) && ['asc', 'desc'].includes(direction) ? [{field, direction}] : [];
  });
  if (sort.length) state.sort = sort;
  for (const key of ['page', 'pageSize']) if (Number.isSafeInteger(source.input?.[key]) && source.input[key] > 0) state[key] = source.input[key];
  if (typeof source.formStatus?.dirty === 'boolean') state.dirty = source.formStatus.dirty;
  if (state.dirty) {
   const baseline = source.selection?.selected || {};
   state.changedFields = pairs(source.form).filter(([key, value]) => text(key) && !secret(key) && !sensitiveFields.has(key)
    && Object.hasOwn(baseline, key) && (value === null || typeof value !== 'object') && !Object.is(value, baseline[key])).slice(0, 12).map(([key]) => key);
  }
  context.sources.push(state);
  if (JSON.stringify(context).length > 8192) {context.sources.pop(); context.truncated = true; break;}
 }
 for (const dialog of (Array.isArray(window.dialogs) ? window.dialogs : []).slice(0, 12)) if (text(dialog.id)) context.dialogs.push({id: dialog.id, open: dialog.open === true});
 const byteSize = () => typeof TextEncoder === 'function' ? new TextEncoder().encode(JSON.stringify(context)).length : JSON.stringify(context).length * 3;
 while (byteSize() > 8000) {
  context.truncated = true;
  if (context.sources.length) context.sources.pop(); else if (context.dialogs.length) context.dialogs.pop(); else if (context.tabs.length) context.tabs.pop(); else break;
 }
 // A change marker, never an authorization token. Timestamp remains the
 // enclosing snapshot's ts so unchanged snapshots keep transport deduplication.
 let revision = 2166136261;
 for (const char of JSON.stringify(context)) revision = Math.imul(revision ^ char.charCodeAt(0), 16777619) >>> 0;
 context.revision = revision;
 return context;
}
