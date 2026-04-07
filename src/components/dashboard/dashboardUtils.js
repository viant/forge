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
            if (Array.isArray(activeValue)) {
                return activeValue.some((entry) => equalsFilterValue(entry, rowValue));
            }
            return equalsFilterValue(activeValue, rowValue);
        });
    });
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

export const formatDashboardValue = (value, format) => {
    if (value == null) return '-';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(Number(value) || 0);
        case 'compactNumber':
            return new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1}).format(Number(value) || 0);
        case 'percent':
            return `${Number(value).toFixed(1)}%`;
        case 'number':
        default:
            return new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(Number(value));
    }
};

export const getDashboardToneName = (value, tone = {}) => {
    const numeric = Number(value);
    if (tone.dangerAbove !== undefined && numeric >= Number(tone.dangerAbove)) return 'danger';
    if (tone.warningAbove !== undefined && numeric >= Number(tone.warningAbove)) return 'warning';
    if (tone.successAbove !== undefined && numeric >= Number(tone.successAbove)) return 'success';
    if (tone.dangerBelow !== undefined && numeric <= Number(tone.dangerBelow)) return 'danger';
    if (tone.warningBelow !== undefined && numeric <= Number(tone.warningBelow)) return 'warning';
    if (tone.successBelow !== undefined && numeric <= Number(tone.successBelow)) return 'success';
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
