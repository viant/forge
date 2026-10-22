import {resolveSelector} from '../utils/selector.js';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

const isEmpty = (value) => {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

// Index owned, immutable fact arrays at snapshot ingestion, never at each guard.
// Weak keys let an old snapshot and its indexes be collected together.
const factMembership = new WeakMap();
function snapshotFacts(value) {
  if (Array.isArray(value)) {
    const result = Object.freeze(value.map(snapshotFacts));
    factMembership.set(result, new Set(result));
    return result;
  }
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, snapshotFacts(entry)])));
  }
  return value;
}

const contains = (actual, expected) => {
  if (Array.isArray(actual)) {
    const index = factMembership.get(actual);
    return index ? index.has(expected) : actual.includes(expected);
  }
  if (typeof actual === 'string') return actual.includes(String(expected));
  if (actual && typeof actual === 'object') return Object.hasOwn(actual, expected);
  return false;
};

const guardKeys = ['visibleWhen', 'hiddenWhen', 'disabledWhen', 'readOnlyWhen'];
const authorizationOperators = new Set(['equals', 'notEquals', 'in', 'contains', 'empty', 'notEmpty', 'exists']);

function validateCondition(condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) throw new Error('condition must be an object');
  for (const op of ['all', 'any']) {
    if (Object.hasOwn(condition, op)) {
      if (!Array.isArray(condition[op]) || condition[op].length === 0 || Object.keys(condition).length !== 1) throw new Error(`malformed ${op} condition`);
      condition[op].forEach(validateCondition);
      return;
    }
  }
  if (Object.hasOwn(condition, 'not')) {
    if (Object.keys(condition).length !== 1) throw new Error('malformed not condition');
    validateCondition(condition.not);
    return;
  }
  if (String(condition.source || '').toLowerCase() !== 'authorization') return;
  if (!(condition.field || condition.selector || condition.key)) throw new Error('authorization field is required');
  const allowed = new Set(['source', 'field', 'selector', 'key', ...authorizationOperators]);
  let operators = 0;
  for (const [key, value] of Object.entries(condition)) {
    if (!allowed.has(key)) throw new Error(`unknown authorization operator ${key}`);
    if (!authorizationOperators.has(key)) continue;
    operators++;
    if (key === 'in' && !Array.isArray(value)) throw new Error('in requires an array');
    if (['empty', 'notEmpty', 'exists'].includes(key) && typeof value !== 'boolean') throw new Error(`${key} requires a boolean`);
  }
  if (operators !== 1) throw new Error('authorization condition requires one operator');
}

function validateGuards(value) {
  if (Array.isArray(value)) { value.forEach(validateGuards); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (guardKeys.includes(key)) validateCondition(child);
    else validateGuards(child);
  }
}

export function evaluateAuthorizationLeaf(condition = {}, authorization = null) {
  if (!authorization || typeof authorization !== 'object') return false;
  const field = condition.field || condition.selector || condition.key;
  const actual = field ? resolveSelector(authorization, field) : authorization;
  if (condition.equals !== undefined) return actual === condition.equals;
  if (condition.notEquals !== undefined) return actual !== condition.notEquals;
  if (Array.isArray(condition.in)) return condition.in.includes(actual);
  if (condition.contains !== undefined) return contains(actual, condition.contains);
  if (condition.empty !== undefined) return isEmpty(actual) === condition.empty;
  if (condition.notEmpty !== undefined) return (!isEmpty(actual)) === condition.notEmpty;
  if (condition.exists !== undefined) return (actual !== undefined && actual !== null) === condition.exists;
  // An authorization condition with no recognized operator is denied.
  return false;
}

// reduceAuthorizationCondition folds authorization leaves while preserving local
// form/selection/metrics leaves for the normal reactive renderer.
export function reduceAuthorizationCondition(condition, authorization = null) {
  if (!condition || typeof condition !== 'object') return {kind: 'constant', value: false};
  if (Array.isArray(condition.all)) {
    const dynamic = [];
    for (const entry of condition.all) {
      const reduced = reduceAuthorizationCondition(entry, authorization);
      if (reduced.kind === 'constant' && !reduced.value) return {kind: 'constant', value: false};
      if (reduced.kind === 'dynamic') dynamic.push(reduced.condition);
    }
    if (dynamic.length === 0) return {kind: 'constant', value: true};
    return {kind: 'dynamic', condition: dynamic.length === 1 ? dynamic[0] : {...condition, all: dynamic}};
  }
  if (Array.isArray(condition.any)) {
    const dynamic = [];
    for (const entry of condition.any) {
      const reduced = reduceAuthorizationCondition(entry, authorization);
      if (reduced.kind === 'constant' && reduced.value) return {kind: 'constant', value: true};
      if (reduced.kind === 'dynamic') dynamic.push(reduced.condition);
    }
    if (dynamic.length === 0) return {kind: 'constant', value: false};
    return {kind: 'dynamic', condition: dynamic.length === 1 ? dynamic[0] : {...condition, any: dynamic}};
  }
  if (condition.not) {
    const reduced = reduceAuthorizationCondition(condition.not, authorization);
    if (reduced.kind === 'constant') return {kind: 'constant', value: !reduced.value};
    return {kind: 'dynamic', condition: {...condition, not: reduced.condition}};
  }
  if (String(condition.source || '').toLowerCase() === 'authorization') {
    return {kind: 'constant', value: evaluateAuthorizationLeaf(condition, authorization)};
  }
  return {kind: 'dynamic', condition: clone(condition)};
}

function applyGuard(node, key, authorization, mode) {
  if (!node[key]) return {remove: false};
  const reduced = reduceAuthorizationCondition(node[key], authorization);
  if (reduced.kind === 'dynamic') {
    node[key] = reduced.condition;
    return {remove: false};
  }
  delete node[key];
  if (mode === 'visible') return {remove: !reduced.value};
  if (mode === 'hidden') return {remove: reduced.value};
  if (mode === 'disabled' && reduced.value) node.disabled = true;
  if (mode === 'readOnly' && reduced.value) node.readOnly = true;
  return {remove: false};
}

function compileNode(value, authorization) {
  if (Array.isArray(value)) {
    return value.map((entry) => compileNode(entry, authorization)).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  const node = {...value};
  if (applyGuard(node, 'visibleWhen', authorization, 'visible').remove) return undefined;
  if (applyGuard(node, 'hiddenWhen', authorization, 'hidden').remove) return undefined;
  applyGuard(node, 'disabledWhen', authorization, 'disabled');
  applyGuard(node, 'readOnlyWhen', authorization, 'readOnly');
  for (const [key, child] of Object.entries(node)) {
    if (['visibleWhen', 'hiddenWhen', 'disabledWhen', 'readOnlyWhen'].includes(key)) continue;
    const compiled = compileNode(child, authorization);
    if (compiled === undefined) delete node[key];
    else node[key] = compiled;
  }
  return node;
}

export function collectDataSourceRefs(metadata) {
  const refs = new Set();
  const visit = (value, key = '') => {
    if (Array.isArray(value)) return value.forEach((entry) => visit(entry, key));
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && /dataSourceRef$/i.test(key)) refs.add(value);
      return;
    }
    for (const [childKey, child] of Object.entries(value)) {
      if (/dataSourceRefs$/i.test(childKey) && child && typeof child === 'object') {
        Object.values(child).forEach((ref) => typeof ref === 'string' && refs.add(ref));
      }
      visit(child, childKey);
    }
  };
  visit(metadata?.view);
  visit(metadata?.dialogs);
  visit(metadata?.window?.titleBinding);
  return refs;
}

export function compilePermittedView(metadata, authorization, {requireRead = false} = {}) {
  if (!metadata || typeof metadata !== 'object') throw new Error('metadata is required');
  if (requireRead && authorization?.resource?.capabilities?.read !== true) {
    return {metadata: null, authorization, dataSourceRefs: new Set(), denied: true, diagnostics: ['resource.read denied']};
  }
  validateGuards(metadata);
  const compiled = compileNode(clone(metadata), authorization);
  const refs = collectDataSourceRefs(compiled);
  if (compiled?.dataSource && typeof compiled.dataSource === 'object') {
    compiled.dataSource = Object.fromEntries(Object.entries(compiled.dataSource).filter(([id]) => refs.has(id)));
  }
  return {metadata: compiled, authorization, dataSourceRefs: refs, denied: false, diagnostics: []};
}

// Delivery hints affect rendered controls only. They must neither admit data
// operations nor remove datasource definitions used by independently authorized MCPs.
export function compileDeliveryHintView(metadata, authorization = {}) {
  validateGuards(metadata?.view);
  validateGuards(metadata?.dialogs);
  return {...metadata,
    view: compileNode(clone(metadata?.view), authorization),
    ...(metadata?.dialogs ? {dialogs: compileNode(clone(metadata.dialogs), authorization)} : {}),
  };
}

export function normalizeAuthorizationSnapshot(response, resourceType = '', resourceId = null) {
  const resources = response?.resources && typeof response.resources === 'object' ? response.resources : {};
  const normalizedResource = response?.resource;
  const retainedResource = normalizedResource && String(normalizedResource.id) === String(resourceId) && (!resourceType || normalizedResource.type === resourceType) ? normalizedResource : null;
  const resource = resourceId == null ? null : resources[String(resourceId)] || retainedResource || null;
  return {
    ...(response?.schemaVersion !== undefined ? {schemaVersion: response.schemaVersion} : {}),
    authorizationVersion: response?.authorizationVersion || '',
    expiresAt: response?.expiresAt || '',
    principal: snapshotFacts(response?.principal || {}),
    account: response?.account || {},
    globalCapabilities: response?.globalCapabilities || {},
    resource: resource ? {...resource, type: resource.type || resourceType} : null,
  };
}

// Keep v2 IDs as exact strings; JavaScript numbers cannot represent large
// resource identifiers without rounding.
export function resolveAuthorizationResourceID(schemaVersion, selected, snapshot) {
  const version = Number(schemaVersion || 1);
  if (version === 1) {
    const id = selected == null || selected === '' ? null : Number(selected);
    return {valid: id == null || Number.isSafeInteger(id) && id > 0, id};
  }
  if (version === 2) {
    if (Number(snapshot?.schemaVersion) !== 2) return {valid: false, id: null};
    if (selected == null || selected === '') return {valid: true, id: null};
    if (typeof selected !== 'string' || selected.trim() !== selected) return {valid: false, id: null};
    return {valid: true, id: selected};
  }
  return {valid: false, id: null};
}

export function authorizationSnapshotLeaseMs(snapshot, now = Date.now()) {
  const expiry = Date.parse(String(snapshot?.expiresAt || ''));
  if (!Number.isFinite(expiry)) return 0;
  return Math.max(0, expiry - now);
}
