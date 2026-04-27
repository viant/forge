import { resolveSelector, setSelector } from '../utils/selector.js';

export function getQuickFilterValue(filter, field) {
    const value = resolveSelector(filter || {}, field);
    return value == null ? '' : String(value);
}

export function mergeQuickFilterValue(filter, field, value) {
    return setSelector(filter || {}, field, value);
}
