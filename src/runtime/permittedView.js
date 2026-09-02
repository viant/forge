import {resolveSelector} from '../utils/selector.js';

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

const isEmpty = (value) => {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

const contains = (actual, expected) => {
  if (Array.isArray(actual)) return actual.includes(expected);
  if (typeof actual === 'string') return actual.includes(String(expected));
  if (actual && typeof actual === 'object') return Object.hasOwn(actual, expected);
  return false;
};

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
  const compiled = compileNode(clone(metadata), authorization);
  const refs = collectDataSourceRefs(compiled);
  if (compiled?.dataSource && typeof compiled.dataSource === 'object') {
    compiled.dataSource = Object.fromEntries(Object.entries(compiled.dataSource).filter(([id]) => refs.has(id)));
  }
  return {metadata: compiled, authorization, dataSourceRefs: refs, denied: false, diagnostics: []};
}

export function normalizeAuthorizationSnapshot(response, resourceType = '', resourceId = null) {
  const resources = response?.resources && typeof response.resources === 'object' ? response.resources : {};
  const resource = resourceId == null ? null : resources[String(resourceId)] || null;
  return {
    authorizationVersion: response?.authorizationVersion || '',
    expiresAt: response?.expiresAt || '',
    principal: response?.principal || {},
    account: response?.account || {},
    globalCapabilities: response?.globalCapabilities || {},
    resource: resource ? {...resource, type: resource.type || resourceType} : null,
  };
}
