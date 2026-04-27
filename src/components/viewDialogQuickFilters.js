import { resolveSelector, setSelector } from '../utils/selector.js';

export function getQuickFilterValue(filter, field) {
    const value = resolveSelector(filter || {}, field);
    return value == null ? '' : String(value);
}

export function mergeQuickFilterValue(filter, field, value) {
    return setSelector(filter || {}, field, value);
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
