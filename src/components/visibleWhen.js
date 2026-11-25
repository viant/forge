import {evaluateCondition} from '../utils/evaluateCondition.js';
import {formFieldValue} from '../runtime/formFieldValue.js';
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

function readConditionValue(visibleWhen, context, row) {
    if (visibleWhen.dataSourceRef) context = resolveChildContext(context, visibleWhen.dataSourceRef) || {};
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
        case 'control':
            scope = context.signals?.control?.peek?.() || context.signals?.control?.value || {};
            break;
        case 'formstatus':
            scope = context.signals?.formStatus?.peek?.() || context.signals?.formStatus?.value || {};
            break;
        case 'row':
            scope = row || context.row || {};
            break;
        case 'form':
        default:
            scope = context.handlers?.dataSource?.peekFormData?.() || {};
            break;
    }

    return field ? resolveSelector(scope, field) : scope;
}

export const evaluatePlainVisibleWhen = (visibleWhen, context, row = undefined) => {
    if (!visibleWhen || !context) return true;
    return evaluateCondition(visibleWhen, leaf => readConditionValue(leaf, context, row));
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
    if (visibleWhen.dataSourceRef) context = resolveChildContext(context, visibleWhen.dataSourceRef) || {};
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
        case 'control':
            context?.signals?.control?.value;
            break;
        case 'formstatus':
            context?.signals?.formStatus?.value;
            break;
        case 'form':
        default:
            formFieldValue(context, visibleWhen.field || visibleWhen.selector || visibleWhen.key);
            break;
    }
};

export const isContainerVisible = (container, baseContext) => {
    const explicitRef = String(container?.dataSourceRef || '').trim();
    if (explicitRef && !baseContext?.metadata?.dataSource?.[explicitRef]) return false;
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
    const explicitRef = String(container?.dataSourceRef || '').trim();
    if (explicitRef && !baseContext?.metadata?.dataSource?.[explicitRef]) return;
    const visibleWhen = getDashboardVisibleWhen(container);
    if (!visibleWhen && !container?.hiddenWhen) {
        return;
    }
    const scopedContext = resolveChildContext(baseContext, container?.dataSourceRef || baseContext?.identity?.dataSourceRef);
    trackVisibleWhen(visibleWhen, scopedContext);
    trackVisibleWhen(container?.hiddenWhen, scopedContext);
};
