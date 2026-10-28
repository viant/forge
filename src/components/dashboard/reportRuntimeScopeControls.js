import {assertSafeAssignmentPath, resolveSelector, setSelector} from '../../utils/selector.js';
import {resolveReportDateRangeValue, updateReportDateRangeValue} from '../../reporting/reportDateRangeValue.js';
import equal from 'fast-deep-equal';

function path(value) {
    if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(value)) {
        throw new Error('Report controls require an explicit safe request path.');
    }
    assertSafeAssignmentPath(value);
    return value;
}

export function reportScopeSourceAvailable(source) {
    const handlers = source?.handlers?.dataSource;
    return !!handlers && ['peekInput', 'setInputParameters', 'setPage', 'fetchCollection', 'setLoading', 'setError'].every(key => typeof handlers[key] === 'function');
}

function targetsFor(config, context, id) {
    const param = config.reportSpec?.scope?.params?.find(entry => entry.id === id);
    if (!param?.filterBindings?.length) return [];
    return param.filterBindings.map(input => {
        const binding = config.datasetBindings?.[input.datasetRef];
        if (!binding?.dataSourceRef || !binding.queryPath) throw new Error('Missing report control dataset binding.');
        path(input.path);
        if (input.valuePath) path(input.valuePath);
        path(binding.queryPath);
        const source = context.Context?.(binding.dataSourceRef);
        const handlers = source?.handlers?.dataSource;
        if (!reportScopeSourceAvailable(source)) {
            throw new Error('Report control datasource is unavailable.');
        }
        return {param, input, binding, source, handlers};
    });
}

export class ReportScopeUnavailableError extends Error {}

function requestFor(target, config) {
    const parameters = target.handlers.peekInput()?.parameters || {};
    const current = resolveSelector(parameters, target.binding.queryPath);
    const fallback = config.reportSpec?.datasets?.find(dataset => dataset.id === target.input.datasetRef)?.request;
    const request = current ?? fallback;
    if (request == null) throw new ReportScopeUnavailableError('Report request is unavailable.');
    if (typeof request !== 'object' || Array.isArray(request)) throw new Error('Report request is unavailable.');
    return {parameters, request};
}

export function boundReportScopeSpec(config, context) {
    const reportSpec = config.reportSpec || {};
    if (!reportSpec.scope?.params) return reportSpec;
    const requests = new Map();
    const params = reportSpec.scope.params.map(param => {
        const targets = targetsFor(config, context, param.id);
        for (const target of targets) requests.set(target.input.datasetRef, requestFor(target, config).request);
        return targets.length ? {...param, value: scopeValue(targets, config)} : param;
    });
    return {...reportSpec, scope: {...reportSpec.scope, params}, datasets: (reportSpec.datasets || []).map(dataset => requests.has(dataset.id)
        ? {...dataset, request: JSON.parse(JSON.stringify(requests.get(dataset.id)))} : dataset)};
}

function scopeValue(targets, config) {
    let value = targets[0].param.value;
    // Split date inputs represent resolved endpoints, not the original expression
    // or preset that produced an earlier default.
    if (targets[0].param.kind === 'dateRange' && targets.some(target => target.input.valuePath)) {
        value = {...value};
        delete value.preset;
        for (const target of targets) {
            if (['start', 'end'].includes(target.input.valuePath)) delete value[`${target.input.valuePath}Expression`];
        }
    }
    const observed = new Map();
    for (const target of targets) {
        const {request} = requestFor(target, config);
        const selected = resolveSelector(request.filters, target.input.path);
        const key = target.input.valuePath || '';
        const effective = selected === undefined ? (key ? resolveSelector(target.param.value, key) : target.param.value) : selected;
        if (observed.has(key) && !equal(observed.get(key), effective)) throw new Error('Shared report control has inconsistent dataset values.');
        observed.set(key, effective);
        if (selected !== undefined) value = target.input.valuePath ? setSelector(value, target.input.valuePath, selected) : selected;
    }
    return value;
}

// Only authored filter paths can be changed. The ordinary datasource owns
// transport, authorization, cancellation, response state, and error handling.
export function boundReportScopeHandlers(config, context) {
    const targets = filter => targetsFor(config, context, filter?.id);
    const update = (filter, compute) => {
        const bound = targets(filter);
        if (!bound.length) return false;
        const {param} = bound[0];
        const current = scopeValue(bound, config);
        const value = compute(param, current);
        if (equal(current, value)) return false;
        if (param.required && (value == null || value === '' || (Array.isArray(value) && !value.length))) return false;
        if (param.required && param.kind === 'dateRange' && (!value?.start || !value?.end)) return false;
        // Prepare every update before mutating any signal. Keep separate queries
        // and fixed inputs even when a control is shared across datasets.
        const updates = new Map();
        for (const target of bound) {
            const previous = updates.get(target.handlers);
            const {parameters: initial, request: fallback} = requestFor(target, config);
            const parameters = previous?.parameters || initial;
            const request = resolveSelector(parameters, target.binding.queryPath) ?? fallback;
            const selected = target.input.valuePath ? resolveSelector(value, target.input.valuePath) : value;
            if (selected === undefined) throw new Error('Report control value is missing a bound field.');
            const next = {...request, offset: 0, filters: setSelector(request.filters, target.input.path, selected)};
            updates.set(target.handlers, {target, parameters: setSelector(parameters, target.binding.queryPath, next)});
        }
        for (const {target} of updates.values()) target.handlers.setLoading(true);
        for (const {target, parameters} of updates.values()) {
            const {handlers} = target;
            handlers.setError(null);
            handlers.setInputParameters(parameters);
            handlers.setPage(1);
            const completion = handlers.fetchCollection();
            if (completion?.catch) completion.catch(() => {}); // datasource publishes its error
        }
        return true;
    };
    return {
        scopeControlCommitMode: 'blur',
        canEditScopeParam: filter => targets(filter).length > 0,
        setScopeParamValue: (filter, value) => update(filter, param => {
            if (value === null && !param.required) return null;
            if (param.kind === 'integer' && !Number.isSafeInteger(value)) throw new Error('Enter a whole number between -9007199254740991 and 9007199254740991.');
            if (param.kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new Error('Enter a finite number within the supported range (-9007199254740991 to 9007199254740991).');
            if ((param.kind === 'text' && typeof value !== 'string')
                || !['integer', 'number', 'text'].includes(param.kind)) throw new Error('Invalid report control value.');
            return value;
        }),
        toggleScopeParamOption: (filter, value) => update(filter, (param, current) => {
            if (!param.options?.some(option => Object.is(option.value, value))) throw new Error('Unknown report control option.');
            if (!param.multiple) return value;
            const values = Array.isArray(current) ? current : [];
            return values.includes(value) ? values.filter(item => !Object.is(item, value)) : [...values, value];
        }),
        setScopeParamDate: (filter, edge, value) => update(filter, (param, current) => {
            if (param.kind !== 'dateRange' || !['start', 'end', 'preset'].includes(edge) || typeof value !== 'string') throw new Error('Invalid report date control value.');
            const next = resolveReportDateRangeValue(updateReportDateRangeValue(current || {}, edge, value));
            const validDate = text => {
                if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
                const parsed = new Date(`${text}T00:00:00Z`);
                return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
            };
            if ((value.trim() && edge !== 'preset' && !validDate(next[edge]))
                || (edge === 'preset' && (!validDate(next.start) || !validDate(next.end)))) throw new Error('Enter a valid date (YYYY-MM-DD) or supported relative expression.');
            for (const endpoint of ['start', 'end']) {
                if ((param.required || next[endpoint]) && !validDate(next[endpoint])) throw new Error('Enter valid start and end dates.');
            }
            if (next.start && next.end && next.start > next.end) throw new Error('Start date must be on or before end date.');
            return next;
        }),
    };
}
