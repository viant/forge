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

export const evaluatePlainVisibleWhen = (visibleWhen, context) => {
    if (!visibleWhen || !context) return true;
    const source = String(visibleWhen.source || 'form').toLowerCase();
    const field = visibleWhen.field || visibleWhen.selector || visibleWhen.key;

    let scope = {};
    switch (source) {
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
    return !!actual;
};

export const trackVisibleWhen = (visibleWhen, context) => {
    if (!visibleWhen || !context) {
        return;
    }
    const source = String(visibleWhen.source || 'form').toLowerCase();
    switch (source) {
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
        case 'form':
        default:
            context?.signals?.form?.value;
            break;
    }
};

export const isContainerVisible = (container, baseContext) => {
    const visibleWhen = getDashboardVisibleWhen(container);
    if (!visibleWhen) {
        return true;
    }
    const scopedContext = resolveChildContext(baseContext, container?.dataSourceRef || baseContext?.identity?.dataSourceRef);
    return scopedContext?.dashboardKey
        ? evaluateDashboardCondition(visibleWhen, {
            context: scopedContext,
            dashboardKey: scopedContext.dashboardKey,
        })
        : evaluatePlainVisibleWhen(visibleWhen, scopedContext);
};

export const trackContainerVisibility = (container, baseContext) => {
    const visibleWhen = getDashboardVisibleWhen(container);
    if (!visibleWhen) {
        return;
    }
    const scopedContext = resolveChildContext(baseContext, container?.dataSourceRef || baseContext?.identity?.dataSourceRef);
    trackVisibleWhen(visibleWhen, scopedContext);
};
