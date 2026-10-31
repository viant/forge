import {resolveKey} from '../../utils/selector.js';
export const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function number(value, label, {nullable = true, max = Infinity} = {}) {
  if (nullable && value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be a finite number between 0 and ${max}.`);
  return value;
}
export function field(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*$/.test(value)) throw new Error(`${label} requires a field path.`);
  return value;
}
export function entries(values, label) {
  if (!Array.isArray(values) || !values.length || values.length > 100) throw new Error(`${label} requires 1–100 entries.`);
  const ids = new Set();
  return values.map(value => {
    if (!value || typeof value.id !== 'string' || !value.id || ids.has(value.id) || typeof value.label !== 'string' || !value.label) throw new Error(`${label} requires unique IDs and labels.`);
    ids.add(value.id);return {...value};
  });
}
export function sum(values) {
  return values.some(value => value == null) ? null : values.reduce((a,b) => {
    const result=a+b;if(!Number.isFinite(result))throw new Error('Scenario total exceeds finite range.');return result;
  },0);
}
export const delta = (value, baseline) => value == null || baseline == null ? null : value-baseline;
export const ratio = (value, total) => value == null || total == null || total === 0 ? null : value/total;
export const read = (row, key) => resolveKey(row,key);
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const display = value => value == null ? 'No data' : new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
export function scenarioState(config, filters = {}, supplied) {
  const result={...config.state,...supplied};
  for(const [key,binding] of Object.entries(config.stateBindings || {})) {
    field(binding.path,'Scenario state binding');
    const value=read(filters,binding.path);if(value!==undefined)result[key]=value;
  }
  return result;
}
export function validateBindings(bindings={}) {
  for(const binding of Object.values(bindings)) {
    if(!binding || typeof binding.paramId!=='string' || !binding.paramId)throw new Error('State bindings require a scope paramId.');
    field(binding.path,'State binding');
  }
  return bindings;
}
export function checkedRows(rows) {
  if(!Array.isArray(rows) || rows.length>10000)throw new Error('Scenario requires at most 10000 rows.');
  return rows;
}
export function graphic(body,width,height,title) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Scenario graphic requires finite positive dimensions.');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}"><style>text{font-family:var(--forge-type-small-family,Arial,sans-serif);font-size:var(--forge-type-small-size,12px);font-weight:var(--forge-type-small-weight,400);line-height:var(--forge-type-small-line-height,1.5);letter-spacing:var(--forge-type-small-letter-spacing,normal);fill:currentColor} .scenario-muted{opacity:.25}</style>${body}</svg>`,height,diagnostics:[]};
}
