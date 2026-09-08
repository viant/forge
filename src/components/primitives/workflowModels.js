import {resolveSelector} from '../../utils/selector.js';
import {evaluatePlainVisibleWhen} from '../visibleWhen.js';

export const primitiveIdentity = (row = {}, fields = ['id']) => fields.map((field) => String(resolveSelector(row, field) ?? '')).join('\u001f');

export function applyAssignment(available = [], assigned = [], selected = [], spec = {}, operation = 'assign') {
  const fields = spec.identityFields?.length ? spec.identityFields : ['id'];
  const selectedKeys = new Set(selected.map((row) => typeof row === 'object' ? primitiveIdentity(row, fields) : String(row)));
  const availableByKey = new Map(available.map((row) => [primitiveIdentity(row, fields), row]));
  const assignedByKey = new Map(assigned.map((row) => [primitiveIdentity(row, fields), row]));
  if (operation === 'assign') {
    for (const key of selectedKeys) if (availableByKey.has(key)) assignedByKey.set(key, availableByKey.get(key));
  } else {
    for (const key of selectedKeys) assignedByKey.delete(key);
  }
  return {
    assigned: [...assignedByKey.values()],
    available: available.filter((row) => !assignedByKey.has(primitiveIdentity(row, fields))),
  };
}

export function availableStatusTransitions(current, workflow = {}, context = {}) {
  return (workflow.transitions || []).filter((transition) => {
    const from = transition.from || [];
    if (from.length && !from.some((value) => String(value) === String(current))) return false;
    return !transition.availableWhen || evaluatePlainVisibleWhen(transition.availableWhen, context);
  });
}

function collectTreeKeys(node, spec, result) {
  result.add(String(resolveSelector(node, spec.identityField || 'id') ?? ''));
  for (const child of resolveSelector(node, spec.childrenField || 'children') || []) collectTreeKeys(child, spec, result);
}

export function toggleTreeSelection(nodes = [], selected = [], key, checked, spec = {}) {
  const result = new Set(selected.map(String));
  const target = [];
  const visit = (items) => {
    for (const node of items || []) {
      if (String(resolveSelector(node, spec.identityField || 'id') ?? '') === String(key)) target.push(node);
      visit(resolveSelector(node, spec.childrenField || 'children'));
    }
  };
  visit(nodes);
  const keys = new Set([String(key)]);
  if (String(spec.cascade || '').toLowerCase() === 'descendants') for (const node of target) collectTreeKeys(node, spec, keys);
  for (const item of keys) checked ? result.add(item) : result.delete(item);
  return [...result];
}

export function wizardState(wizard = {}, context = {}, currentStep = 0) {
  const visible = (wizard.steps || []).filter((step) => !step.visibleWhen || evaluatePlainVisibleWhen(step.visibleWhen, context));
  const currentIndex = typeof currentStep === 'string' ? visible.findIndex((step) => step.id === currentStep) : Number(currentStep);
  const index = Math.max(0, Math.min(currentIndex, Math.max(visible.length - 1, 0)));
  const current = visible[index] || null;
  const valid = !!current && (!current.validWhen || evaluatePlainVisibleWhen(current.validWhen, context));
  return {steps: visible, index, current, valid, canBack: index > 0, canNext: valid && index < visible.length - 1, canSubmit: valid && index === visible.length - 1};
}

function acceptedFileType(file, accept = []) {
  if (!accept.length) return true;
  return accept.some((rule) => {
    const value = String(rule || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '').toLowerCase();
    if (value.startsWith('.')) return name.endsWith(value);
    if (value.endsWith('/*')) return type.startsWith(value.slice(0, -1));
    return type === value;
  });
}

export function validateUploadCollection(files = [], spec = {}) {
  const rows = Array.isArray(files) ? files : [];
  const errors = [];
  if (spec.multiple === false && rows.length > 1) errors.push('Only one file is allowed.');
  if (Number(spec.maxFiles) > 0 && rows.length > Number(spec.maxFiles)) errors.push(`No more than ${spec.maxFiles} files are allowed.`);
  rows.forEach((file) => {
    if (!acceptedFileType(file, spec.accept || [])) errors.push(`${file.name || 'File'} has an unsupported type.`);
    if (Number(spec.maxBytes) > 0 && Number(file.size || 0) > Number(spec.maxBytes)) errors.push(`${file.name || 'File'} exceeds the size limit.`);
  });
  return {valid: errors.length === 0, errors};
}

function rowMatches(row, when = {}) {
  if (when.all) return when.all.every((entry) => rowMatches(row, entry));
  if (when.any) return when.any.some((entry) => rowMatches(row, entry));
  if (when.not) return !rowMatches(row, when.not);
  const value = resolveSelector(row, when.field || '');
  if ('equals' in when) return value === when.equals;
  if ('notEquals' in when) return value !== when.notEquals;
  if (Array.isArray(when.in)) return when.in.includes(value);
  if (when.notEmpty === true) return value != null && String(value).trim() !== '';
  if (when.empty === true) return value == null || String(value).trim() === '';
  return !!value;
}

function projectRow(row, fields = {}, projections = []) {
  const result = {};
  for (const [target, source] of Object.entries(fields || {})) result[target] = typeof source === 'string' ? resolveSelector(row, source) : source;
  for (const projection of projections || []) result[projection.target] = projection.source ? resolveSelector(row, projection.source) : projection.value;
  return result;
}

function aggregateRows(rows, step) {
  const groupBy = step.groupBy || [];
  const grouped = new Map();
  for (const row of rows) {
    const key = primitiveIdentity(row, groupBy);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.values()].map((members) => {
    const result = {};
    for (const field of groupBy) result[field] = resolveSelector(members[0], field);
    for (const measure of step.measures || []) {
      const values = members.map((row) => resolveSelector(row, measure.source || '')).filter((value) => value != null);
      const operation = String(measure.operation || '').toLowerCase();
      if (operation === 'count') result[measure.target] = measure.source ? values.length : members.length;
      if (operation === 'sum') result[measure.target] = values.reduce((total, value) => total + Number(value || 0), 0);
      if (operation === 'min') result[measure.target] = values.length ? values.reduce((left, right) => left < right ? left : right) : undefined;
      if (operation === 'max') result[measure.target] = values.length ? values.reduce((left, right) => left > right ? left : right) : undefined;
      if (operation === 'first') result[measure.target] = values[0];
      if (operation === 'list') result[measure.target] = values;
    }
    return result;
  });
}

export function runDerivedPipeline(sources = {}, spec = {}) {
  const maxRows = Number(spec.maxRows) > 0 ? Number(spec.maxRows) : 10000;
  for (const source of spec.sources || []) if ((sources?.[source] || []).length > maxRows) throw new Error(`Derived datasource source ${source} exceeds maxRows ${maxRows}; use a server datasource.`);
  let rows = [...(sources?.[spec.sources?.[0]] || [])];
  if (rows.length > maxRows) throw new Error(`Derived datasource input exceeds maxRows ${maxRows}; use a server datasource.`);
  const allowedOperations = new Set(['filter', 'select', 'map', 'union', 'join', 'group', 'sort']);
  for (const step of spec.pipeline || []) {
    const operation = String(step.operation || '').toLowerCase();
    if (!allowedOperations.has(operation)) throw new Error(`Unsupported derived operation: ${step.operation || '<empty>'}`);
    if ((operation === 'join' || operation === 'union') && (!step.source || !(spec.sources || []).includes(step.source))) throw new Error(`Derived ${operation} source ${step.source || '<empty>'} must be declared in sources.`);
    if (operation === 'filter') rows = rows.filter((row) => rowMatches(row, step.when || {}));
    if (operation === 'select' || operation === 'map') rows = rows.map((row) => ({...row, ...projectRow(row, step.fields, step.projections)}));
    if (operation === 'union') {
      const unionRows = sources?.[step.source] || [];
      if (rows.length + unionRows.length > maxRows) throw new Error(`Derived datasource output exceeds maxRows ${maxRows}; use a server datasource.`);
      rows = [...rows, ...unionRows];
    }
    if (operation === 'join') {
      const keys = step.on || ['id'];
      const right = new Map();
      for (const row of sources?.[step.source] || []) {
        const key = primitiveIdentity(row, keys);
        if (right.has(key) && String(step.joinCardinality || 'one') === 'one') throw new Error(`Derived join expected one right row for key ${key}.`);
        if (!right.has(key)) right.set(key, []);
        right.get(key).push(row);
      }
      const joined = [];
      for (const row of rows) {
        const matches = right.get(primitiveIdentity(row, keys)) || [];
        if (!matches.length && String(step.joinType || 'left') === 'inner') continue;
        const selectedMatches = String(step.joinCardinality || 'one') === 'many' ? (matches.length ? matches : [{}]) : [matches[0] || {}];
        for (const match of selectedMatches) {
          joined.push({...row, ...projectRow(match, step.fields, step.projections)});
          if (joined.length > maxRows) throw new Error(`Derived datasource output exceeds maxRows ${maxRows}; use a server datasource.`);
        }
      }
      rows = joined;
    }
    if (operation === 'group') rows = aggregateRows(rows, step);
    if (operation === 'sort') {
      const order = step.orderBy || [];
      rows.sort((left, right) => {
        for (const item of order) {
          const a = resolveSelector(left, item.columnId);
          const b = resolveSelector(right, item.columnId);
          const value = typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''));
          if (value) return String(item.direction).toLowerCase() === 'desc' ? -value : value;
        }
        return 0;
      });
    }
    if (rows.length > maxRows) throw new Error(`Derived datasource output exceeds maxRows ${maxRows}; use a server datasource.`);
  }
  return rows;
}

export function permissionBoundaryState(rows = [], authorizationByID = {}, spec = {}) {
  const field = spec.identityField || 'id';
  const capability = spec.capability || 'read';
  const allowed = [];
  const denied = [];
  for (const row of rows) {
    const id = String(resolveSelector(row, field) ?? '');
    (authorizationByID?.[id]?.capabilities?.[capability] === true ? allowed : denied).push(row);
  }
  return {allowed, denied, allAllowed: denied.length === 0, mixed: allowed.length > 0 && denied.length > 0};
}

export function responsiveDataGridState(spec = {}, target = 'desktop') {
  return spec.breakpoints?.[target] || spec.breakpoints?.desktop || {columns: [], stickyColumns: [], density: '', rowLayout: ''};
}

function canonicalValue(value, arrayStrategy = 'ordered') {
  if (Array.isArray(value)) {
    const rows = value.map((item) => canonicalValue(item, arrayStrategy));
    return arrayStrategy === 'set' ? rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) : rows;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key], arrayStrategy)]));
  return value;
}

function flattenHistory(value, prefix = '', result = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value)) flattenHistory(value[key], prefix ? `${prefix}.${key}` : key, result);
  } else result[prefix] = value;
  return result;
}

export function diffHistoryRecords(before = {}, after = {}, spec = {}) {
  const ignored = new Set(spec.ignoreFields || []);
  const redacted = new Set(spec.redactFields || []);
  const left = flattenHistory(before);
  const right = flattenHistory(after);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter((field) => !ignored.has(field) && JSON.stringify(canonicalValue(left[field], spec.arrayStrategy)) !== JSON.stringify(canonicalValue(right[field], spec.arrayStrategy)))
    .map((field) => ({field, before: redacted.has(field) ? '••••' : left[field], after: redacted.has(field) ? '••••' : right[field]}));
}

export function validateSchedule(rows = [], spec = {}) {
  const startField = spec.startField || 'start';
  const endField = spec.endField || 'end';
  const normalized = rows.map((row, index) => ({index, start: new Date(resolveSelector(row, startField)).getTime(), end: new Date(resolveSelector(row, endField)).getTime()}));
  const errors = [];
  normalized.forEach((row) => {
    if (Object.values(rows[row.index]?._scheduleErrors || {}).some(Boolean)) errors.push({index: row.index, code: 'timezone'});
    if (!Number.isFinite(row.start) || !Number.isFinite(row.end)) errors.push({index: row.index, code: 'invalid_date'});
    else if (row.end <= row.start) errors.push({index: row.index, code: 'invalid_range'});
  });
  const durationMatch = String(spec.minDuration || '').trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (durationMatch) {
    const unit = {ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000}[durationMatch[2].toLowerCase()];
    const minimum = Number(durationMatch[1]) * unit;
    normalized.forEach((row) => {
      if (Number.isFinite(row.start) && Number.isFinite(row.end) && row.end - row.start < minimum) errors.push({index: row.index, code: 'min_duration'});
    });
  }
  if (spec.allowOverlap === false) {
    const sorted = normalized.filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end)).sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) errors.push({index: sorted[i].index, code: 'overlap'});
  }
  return {valid: errors.length === 0, errors};
}
