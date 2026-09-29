import {formatReportRelativeTime, resolveReportRelativeDateRange} from './reportRelativeDateRangeModel.js';

export function resolveReportDateRangeValue(value, now = new Date()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const preset = resolveReportRelativeDateRange(value.preset, now);
    if (preset) return {...value, ...preset};
    if (!('startExpression' in value) && !('endExpression' in value)) return value;
    const resolved = {...value};
    for (const edge of ['start', 'end']) {
        if (`${edge}Expression` in value) resolved[edge] = formatReportRelativeTime(value[`${edge}Expression`], {now});
    }
    return resolved;
}

export function updateReportDateRangeValue(previous = {}, edge, input = '', now = new Date()) {
    if (edge === 'preset') return {preset: input};
    if (!['start', 'end'].includes(edge)) return previous;
    const value = String(input || '').trim();
    const next = {...previous};
    delete next.preset;
    if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        next[edge] = value;
        delete next[`${edge}Expression`];
    } else {
        next[`${edge}Expression`] = value;
        next[edge] = formatReportRelativeTime(value, {now});
    }
    return next;
}
