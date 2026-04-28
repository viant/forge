import {getBusSignal, getDashboardFilterSignal, getDashboardSelectionSignal} from "../../core/store/signals.js";
import {resolveKey} from "../../utils/selector.js";

export const getDashboardKeyForContainer = (context, container) => {
    if (container?.dashboard?.key) {
        return container.dashboard.key;
    }
    if (!context?.identity?.windowId || !container?.id) {
        return context?.dashboardKey;
    }
    return `${context.identity.windowId}:${container.id}`;
};

export const withDashboardContext = (context, dashboardKey) => {
    if (!context || !dashboardKey) {
        return context;
    }
    if (context.dashboardKey === dashboardKey && context.identity?.dashboardKey === dashboardKey) {
        return context;
    }

    const wrap = (ctx) => withDashboardContext(ctx, dashboardKey);
    return {
        ...context,
        dashboardKey,
        identity: {
            ...context.identity,
            dashboardKey,
        },
        Context: (dataSourceRef) => wrap(context.Context(dataSourceRef)),
    };
};

export const createDashboardContext = (context, container) => {
    const dashboardKey = context?.dashboardKey || getDashboardKeyForContainer(context, container);
    if (!dashboardKey) {
        return context;
    }

    const nextContext = withDashboardContext(context, dashboardKey);
    getDashboardFilterSignal(dashboardKey, {});
    getDashboardSelectionSignal(dashboardKey, {dimension: null, entityKey: null, pointKey: null});
    return nextContext;
};

export const getDashboardVisibleWhen = (container = {}) => (
    container?.dashboard?.visibleWhen || container?.visibleWhen || null
);

const collectDashboardContainers = (containers = []) => {
    const result = [];
    for (const entry of containers || []) {
        if (!entry) {
            continue;
        }
        result.push(entry);
        if (Array.isArray(entry.containers) && entry.containers.length > 0) {
            result.push(...collectDashboardContainers(entry.containers));
        }
    }
    return result;
};

export const buildDashboardDefaultFilters = (container) => {
    const dashboardContainer = container?.kind === 'dashboard' ? container : null;
    const filterBlocks = collectDashboardContainers(dashboardContainer?.containers || []).filter((block) => block?.kind === 'dashboard.filters');
    const defaults = {};

    for (const block of filterBlocks) {
        for (const item of block.items || []) {
            const field = item.field || item.id;
            if (!field || defaults[field] !== undefined) {
                continue;
            }
            const selected = (item.options || []).filter((option) => option.default).map((option) => option.value);
            if (!selected.length) {
                continue;
            }
            defaults[field] = item.multiple ? selected : selected[0];
        }
    }

    return defaults;
};

const equalsFilterValue = (filterValue, rowValue) => {
    if (rowValue == null) {
        return false;
    }
    return String(rowValue).toLowerCase() === String(filterValue).toLowerCase();
};

export const applyDashboardFiltersToCollection = (collection = [], filterBindings = {}, dashboardFilters = {}) => {
    const entries = Object.entries(filterBindings || {}).filter(([, rowField]) => rowField);
    if (!entries.length) {
        return collection || [];
    }

    return (collection || []).filter((row) => {
        return entries.every(([filterField, rowField]) => {
            const activeValue = dashboardFilters?.[filterField];
            if (activeValue == null || activeValue === '' || (Array.isArray(activeValue) && activeValue.length === 0)) {
                return true;
            }

            const rowValue = resolveKey(row, rowField);

            // Date range filter: { start, end }
            if (activeValue && typeof activeValue === 'object' && !Array.isArray(activeValue) && (activeValue.start || activeValue.end)) {
                const rv = String(rowValue ?? '');
                if (activeValue.start && rv < activeValue.start) return false;
                if (activeValue.end && rv > activeValue.end) return false;
                return true;
            }

            if (Array.isArray(activeValue)) {
                return activeValue.some((entry) => equalsFilterValue(entry, rowValue));
            }
            return equalsFilterValue(activeValue, rowValue);
        });
    });
};

export const applyDashboardSelectionToCollection = (collection = [], selectionBindings = {}, dashboardSelection = {}) => {
    const entries = Object.entries(selectionBindings || {}).filter(([, rowField]) => rowField);
    if (!entries.length) {
        return collection || [];
    }

    const activeEntries = entries
        .map(([selectionField, rowField]) => ({
            selectionField,
            rowField,
            value: resolveKey(dashboardSelection || {}, selectionField),
        }))
        .filter(({value}) => !(value == null || value === '' || (Array.isArray(value) && value.length === 0)));

    if (!activeEntries.length) {
        return collection || [];
    }

    return (collection || []).filter((row) => activeEntries.every(({rowField, value}) => {
        const rowValue = resolveKey(row, rowField);
        if (Array.isArray(value)) {
            return value.some((entry) => equalsFilterValue(entry, rowValue));
        }
        return equalsFilterValue(value, rowValue);
    }));
};

export const createDashboardConditionSnapshot = ({context, dashboardKey, metrics, dashboardFilters, dashboardSelection} = {}) => {
    const resolvedDashboardKey = dashboardKey || context?.dashboardKey;
    return {
        context,
        dashboardKey: resolvedDashboardKey,
        metrics: metrics ?? context?.signals?.metrics?.value ?? context?.signals?.metrics?.peek?.() ?? {},
        dashboardFilters: dashboardFilters ?? (
            resolvedDashboardKey ? (getDashboardFilterSignal(resolvedDashboardKey).value || {}) : {}
        ),
        dashboardSelection: dashboardSelection ?? (
            resolvedDashboardKey ? (getDashboardSelectionSignal(resolvedDashboardKey).value || {}) : {}
        ),
    };
};

export const interpolateDashboardTemplate = (template, scope = {}) => {
    if (typeof template !== 'string') {
        return template;
    }
    return template.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const value = resolveKey(scope, path.trim());
        return value == null ? '' : String(value);
    });
};

export const formatDashboardValue = (value, format, locale = 'en-US') => {
    if (value == null) return '-';

    const numeric = Number(value);
    const isNumeric = Number.isFinite(numeric);

    if (!isNumeric) {
        if (typeof value === 'string' && value.trim() !== '') {
            return value;
        }
        return '-';
    }

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat(locale, {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(numeric);
        case 'compactNumber':
            return new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 1}).format(numeric);
        case 'percent':
            return `${numeric.toFixed(1)}%`;
        case 'percentFraction':
            return `${(numeric * 100).toFixed(1)}%`;
        case 'number':
        default:
            return new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(numeric);
    }
};

export const formatDashboardDelta = (value, format = 'numberDelta', locale = 'en-US') => {
    if (value == null) {
        return '-';
    }

    const numeric = Number(value) || 0;
    const absolute = Math.abs(numeric);
    const prefix = numeric >= 0 ? '+' : '-';

    switch (format) {
        case 'percentDelta':
            return `${prefix}${absolute.toFixed(1)}%`;
        case 'percentFractionDelta':
            return `${prefix}${(absolute * 100).toFixed(1)}%`;
        case 'compactNumberDelta':
            return `${prefix}${new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 1}).format(absolute)}`;
        case 'currencyDelta':
            return `${prefix}${new Intl.NumberFormat(locale, {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(absolute)}`;
        case 'numberDelta':
        case 'number':
        default:
            return `${prefix}${new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(absolute)}`;
    }
};

export const getDashboardToneName = (value, tone = {}) => {
    const normalizedTone = {...(tone || {})};
    if (normalizedTone.warningAbove !== undefined && normalizedTone.dangerAbove !== undefined) {
        const warningAbove = Number(normalizedTone.warningAbove);
        const dangerAbove = Number(normalizedTone.dangerAbove);
        normalizedTone.warningAbove = Math.min(warningAbove, dangerAbove);
        normalizedTone.dangerAbove = Math.max(warningAbove, dangerAbove);
    }
    if (normalizedTone.warningBelow !== undefined && normalizedTone.dangerBelow !== undefined) {
        const warningBelow = Number(normalizedTone.warningBelow);
        const dangerBelow = Number(normalizedTone.dangerBelow);
        normalizedTone.warningBelow = Math.max(warningBelow, dangerBelow);
        normalizedTone.dangerBelow = Math.min(warningBelow, dangerBelow);
    }

    const numeric = Number(value);
    if (normalizedTone.dangerAbove !== undefined && numeric >= Number(normalizedTone.dangerAbove)) return 'danger';
    if (normalizedTone.warningAbove !== undefined && numeric >= Number(normalizedTone.warningAbove)) return 'warning';
    if (normalizedTone.successAbove !== undefined && numeric >= Number(normalizedTone.successAbove)) return 'success';
    if (normalizedTone.dangerBelow !== undefined && numeric <= Number(normalizedTone.dangerBelow)) return 'danger';
    if (normalizedTone.warningBelow !== undefined && numeric <= Number(normalizedTone.warningBelow)) return 'warning';
    if (normalizedTone.successBelow !== undefined && numeric <= Number(normalizedTone.successBelow)) return 'success';
    return 'info';
};

const pickConditionValue = (condition, snapshot) => {
    const field = condition?.field || condition?.selector || condition?.key;
    const source = condition?.source || 'metrics';
    const {context, dashboardKey} = snapshot || {};

    switch (source) {
        case 'selection':
            return field ? resolveKey(snapshot?.dashboardSelection || {}, field) : (snapshot?.dashboardSelection || {});
        case 'filters':
        case 'filter':
            return field ? resolveKey(snapshot?.dashboardFilters || {}, field) : (snapshot?.dashboardFilters || {});
        case 'context':
            return field ? resolveKey(context, field) : context;
        case 'metrics':
        default: {
            const metrics = snapshot?.metrics || {};
            return field ? resolveKey(metrics, field) : metrics;
        }
    }
};

export const evaluateDashboardConditionSnapshot = (condition, snapshot) => {
    if (!condition) {
        return true;
    }

    const value = pickConditionValue(condition, snapshot);

    if (condition.equals !== undefined && value !== condition.equals) return false;
    if (condition.notEquals !== undefined && value === condition.notEquals) return false;
    if (Array.isArray(condition.in) && !condition.in.includes(value)) return false;
    if (condition.gt !== undefined && !(Number(value) > Number(condition.gt))) return false;
    if (condition.gte !== undefined && !(Number(value) >= Number(condition.gte))) return false;
    if (condition.lt !== undefined && !(Number(value) < Number(condition.lt))) return false;
    if (condition.lte !== undefined && !(Number(value) <= Number(condition.lte))) return false;
    if (condition.empty === true) {
        return value == null || value === '' || (Array.isArray(value) && value.length === 0);
    }
    if (condition.notEmpty === true) {
        return !(value == null || value === '' || (Array.isArray(value) && value.length === 0));
    }

    return true;
};

export const evaluateDashboardCondition = (condition, scope) => {
    return evaluateDashboardConditionSnapshot(condition, createDashboardConditionSnapshot(scope));
};

export const publishDashboardSelection = ({context, dimension, entityKey, pointKey = null, selected = null, sourceBlockId = null}) => {
    const dashboardKey = context?.dashboardKey;
    const windowId = context?.identity?.windowId;
    if (!dashboardKey || !windowId) {
        return;
    }

    return setDashboardSelectionState({
        windowId,
        dashboardKey,
        dimension,
        entityKey,
        pointKey,
        selected,
        sourceBlockId,
    });
};

export const setDashboardSelectionState = ({
    windowId,
    dashboardKey,
    dimension = null,
    entityKey = null,
    pointKey = null,
    selected = null,
    sourceBlockId = null,
} = {}) => {
    if (!dashboardKey || !windowId) {
        return null;
    }
    const payload = {
        dashboardKey,
        dimension: dimension || null,
        entityKey: entityKey ?? null,
        pointKey,
        selected,
        sourceBlockId: sourceBlockId || null,
    };

    getDashboardSelectionSignal(dashboardKey).value = payload;
    const bus = getBusSignal(windowId);
    bus.value = [...(bus.peek() || []), {type: 'dashboard.selection.changed', ...payload}];
    return payload;
};
