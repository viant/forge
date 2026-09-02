import {resolveSelector} from '../utils/selector.js';
import {evaluateDashboardCondition, getDashboardVisibleWhen} from './dashboard/dashboardUtils.js';

export const resolveChildContext = (baseContext, dataSourceRef) => {
    const targetRef = dataSourceRef || baseContext?.identity?.dataSourceRef;
    if (!targetRef) {
        return baseContext;
    }
    if (baseContext?.signals && baseContext?.identity?.dataSourceRef === targetRef) {
        return baseContext;
    }
    return typeof baseContext?.Context === 'function' ? baseContext.Context(targetRef) : baseContext;
};

const isEmptyValue = (value) => {
    if (value == null) return true;
    if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

const containsValue = (actual, expected) => {
    if (Array.isArray(actual)) return actual.includes(expected);
    if (typeof actual === 'string') return actual.includes(String(expected));
    if (actual && typeof actual === 'object') return Object.hasOwn(actual, expected);
    return false;
};

export const evaluatePlainVisibleWhen = (visibleWhen, context) => {
    if (!visibleWhen || !context) return true;
    if (Array.isArray(visibleWhen.all)) {
        return visibleWhen.all.every((condition) => evaluatePlainVisibleWhen(condition, context));
    }
    if (Array.isArray(visibleWhen.any)) {
        return visibleWhen.any.some((condition) => evaluatePlainVisibleWhen(condition, context));
    }
    if (visibleWhen.not) {
        return !evaluatePlainVisibleWhen(visibleWhen.not, context);
    }
    const source = String(visibleWhen.source || 'form').toLowerCase();
    const field = visibleWhen.field || visibleWhen.selector || visibleWhen.key;

    let scope = {};
    switch (source) {
        case 'authorization':
            scope = context.signals?.authorization?.peek?.() || context.authorization || {};
            break;
        case 'windowform':
            scope = context.signals?.windowForm?.peek?.() || {};
            break;
        case 'filter':
        case 'filters':
            scope = context.handlers?.dataSource?.peekFilter?.() || {};
            break;
        case 'selection':
            scope = context.signals?.selection?.peek?.() || {};
            break;
        case 'input':
            scope = context.signals?.input?.peek?.() || {};
            break;
        case 'metrics':
            scope = context.signals?.metrics?.peek?.() || {};
            break;
        case 'collection':
            scope = context.signals?.collection?.peek?.() || [];
            break;
        case 'form':
        default:
            scope = context.handlers?.dataSource?.peekFormData?.() || {};
            break;
    }

    const actual = field ? resolveSelector(scope, field) : scope;
    if (visibleWhen.equals !== undefined) {
        return actual === visibleWhen.equals;
    }
    if (Array.isArray(visibleWhen.in)) {
        return visibleWhen.in.includes(actual);
    }
    if (visibleWhen.notEquals !== undefined) {
        return actual !== visibleWhen.notEquals;
    }
    if (visibleWhen.contains !== undefined) {
        return containsValue(actual, visibleWhen.contains);
    }
    if (visibleWhen.empty !== undefined) {
        return isEmptyValue(actual) === visibleWhen.empty;
    }
    if (visibleWhen.notEmpty !== undefined) {
        return (!isEmptyValue(actual)) === visibleWhen.notEmpty;
    }
    if (visibleWhen.exists !== undefined) {
        return (actual !== undefined && actual !== null) === visibleWhen.exists;
    }
    if (source === 'authorization') {
        return false;
    }
    return !!actual;
};

export const trackVisibleWhen = (visibleWhen, context) => {
    if (!visibleWhen || !context) {
        return;
    }
    const nested = [
        ...(Array.isArray(visibleWhen.all) ? visibleWhen.all : []),
        ...(Array.isArray(visibleWhen.any) ? visibleWhen.any : []),
        ...(visibleWhen.not ? [visibleWhen.not] : []),
    ];
    if (nested.length > 0) {
        nested.forEach((condition) => trackVisibleWhen(condition, context));
        return;
    }
    const source = String(visibleWhen.source || 'form').toLowerCase();
    switch (source) {
        case 'authorization':
            if (context?.signals?.authorization) context.signals.authorization.value;
            break;
        case 'windowform':
            context?.signals?.windowForm?.value;
            break;
        case 'filter':
        case 'filters':
            context?.signals?.input?.value?.filter;
            break;
        case 'selection':
            context?.signals?.selection?.value;
            break;
        case 'input':
            context?.signals?.input?.value;
            break;
        case 'metrics':
            context?.signals?.metrics?.value;
            break;
        case 'collection':
            context?.signals?.collection?.value;
            break;
        case 'form':
        default:
            context?.signals?.form?.value;
            break;
    }
};

export const isContainerVisible = (container, baseContext) => {
    const visibleWhen = getDashboardVisibleWhen(container);
    const scopedContext = resolveChildContext(baseContext, container?.dataSourceRef || baseContext?.identity?.dataSourceRef);
    const visible = !visibleWhen ? true : scopedContext?.dashboardKey
        ? evaluateDashboardCondition(visibleWhen, {
            context: scopedContext,
            dashboardKey: scopedContext.dashboardKey,
        })
        : evaluatePlainVisibleWhen(visibleWhen, scopedContext);
    if (!visible) return false;
    return !container?.hiddenWhen || !evaluatePlainVisibleWhen(container.hiddenWhen, scopedContext);
};

export const trackContainerVisibility = (container, baseContext) => {
    const visibleWhen = getDashboardVisibleWhen(container);
    if (!visibleWhen && !container?.hiddenWhen) {
        return;
    }
    const scopedContext = resolveChildContext(baseContext, container?.dataSourceRef || baseContext?.identity?.dataSourceRef);
    trackVisibleWhen(visibleWhen, scopedContext);
    trackVisibleWhen(container?.hiddenWhen, scopedContext);
};
