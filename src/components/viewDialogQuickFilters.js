import { resolveSelector, setSelector } from '../utils/selector.js';

export function getQuickFilterValue(filter, field) {
    const value = resolveSelector(filter || {}, field);
    return value == null ? '' : String(value);
}

export function mergeQuickFilterValue(filter, field, value) {
    const next = { ...(filter || {}) };
    const normalized = value == null ? '' : String(value);
    if (!normalized.trim()) {
        return deleteSelector(next, field);
    }
    return setSelector(next, field, value);
}

export function buildQuickFilterSeed(args, quickFilterSpecs = []) {
    let filter = {};
    for (const spec of Array.isArray(quickFilterSpecs) ? quickFilterSpecs : []) {
        const value = getQuickFilterValue(args, spec?.field);
        if (!value) {
            continue;
        }
        filter = mergeQuickFilterValue(filter, spec.field, value);
    }
    return filter;
}

function deleteSelector(target, path) {
    if (!target || typeof target !== 'object') return {};
    const parts = String(path || '').split('.').filter(Boolean);
    if (parts.length === 0) return target;
    const root = { ...target };
    const stack = [];
    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
        const key = parts[i];
        const next = current?.[key];
        if (!next || typeof next !== 'object') {
            return root;
        }
        const cloned = Array.isArray(next) ? [...next] : { ...next };
        current[key] = cloned;
        stack.push([current, key]);
        current = cloned;
    }
    delete current[parts[parts.length - 1]];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
        const [parent, key] = stack[i];
        const child = parent[key];
        if (child && typeof child === 'object' && Object.keys(child).length === 0) {
            delete parent[key];
        }
    }
    return root;
}
