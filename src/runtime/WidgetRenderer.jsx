/* -------------------------------------------------------------------------
 * WidgetRenderer – generic control renderer (Phase 1 placeholder)
 * -------------------------------------------------------------------------
 * 1. Determine widget key via explicit item.widget → classifier().
 * 2. Resolve widget factory from registry.
 * 3. Build props using binding helpers (state adapter, event adapter, etc.).
 * 4. Render within ControlWrapper for label / span.
 * ---------------------------------------------------------------------- */

import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';

import {classify} from './widgetClassifier.js';
import {getWidgetEntry} from './widgetRegistry.jsx';
import {getEventAdapter, resolveStateAdapter, runDynamicEvaluators,} from './binding.js';
import {resolveSelector} from '../utils/selector.js';
import { resolveLinkTarget } from '../utils/linkTarget.js';
import {evaluatePlainVisibleWhen} from '../components/visibleWhen.js';
import {resolveDynamicDataSourceRef} from './dataSourceRef.js';

import ControlWrapper from './ControlWrapper.jsx';

function resolveOptionFilterScope(context, source = 'form') {
    switch (String(source || 'form').trim().toLowerCase()) {
        case 'windowform':
            return context?.signals?.windowForm?.value || {};
        case 'input':
        case 'filter':
        case 'filters':
            return context?.signals?.input?.value || {};
        case 'selection': {
            const selection = context?.handlers?.dataSource?.getSelection?.()
                || context?.signals?.selection?.value
                || {};
            return selection?.selected ?? selection?.selection ?? selection;
        }
        case 'form':
        default:
            return context?.handlers?.dataSource?.getFormData?.()
                || context?.signals?.form?.value
                || {};
    }
}

function filterDataSourceOptions(rows, optionFilter, context) {
    const filters = Array.isArray(optionFilter) ? optionFilter : optionFilter ? [optionFilter] : [];
    if (filters.length === 0) return rows;
    return rows.filter((row) => filters.every((filter) => {
        const expected = resolveSelector(
            resolveOptionFilterScope(context, filter?.source),
            filter?.selector || filter?.valueSelector || '',
        );
        if (expected === undefined || expected === null || expected === '') return true;
        const actual = resolveSelector(row, filter?.field || filter?.rowSelector || '');
        if (filter?.caseInsensitive === true) {
            return String(actual ?? '').toLowerCase() === String(expected).toLowerCase();
        }
        return actual === expected;
    }));
}

export function resolveDataSourceOptions(item = {}, context = {}, fallback = []) {
    const dataSourceRef = String(item?.optionsDataSourceRef || '').trim();
    if (!dataSourceRef || typeof context?.Context !== 'function') {
        return Array.isArray(fallback) ? fallback : [];
    }
    try {
        const optionContext = context.Context(dataSourceRef);
        const rows = optionContext?.signals?.collection?.value
            || optionContext?.signals?.collection?.peek?.()
            || [];
        if (!Array.isArray(rows)) return Array.isArray(fallback) ? fallback : [];
        const labelSelector = String(item?.optionLabelField || item?.optionLabelSelector || 'label').trim();
        const valueSelector = String(item?.optionValueField || item?.optionValueSelector || 'value').trim();
        const secondarySelector = String(item?.optionSecondaryField || item?.optionSecondarySelector || '').trim();
        const options = filterDataSourceOptions(rows, item?.optionFilter || item?.optionFilters, context)
            .map((row) => {
                const value = resolveSelector(row, valueSelector);
                const label = resolveSelector(row, labelSelector);
                if (value === undefined || value === null || label === undefined || label === null) return null;
                const secondary = secondarySelector ? resolveSelector(row, secondarySelector) : undefined;
                const displayLabel = secondary === undefined || secondary === null || secondary === ''
                    ? String(label)
                    : `${String(label)} (${String(secondary)})`;
                return secondary === undefined || secondary === null || secondary === ''
                    ? {value, label: displayLabel}
                    : {value, label: displayLabel, secondary};
            })
            .filter(Boolean);
        if (item?.includeEmptyOption === true) {
            return [{value: '', label: String(item?.emptyOptionLabel || 'Select…')}, ...options];
        }
        return options;
    } catch (_) {
        return Array.isArray(fallback) ? fallback : [];
    }
}

export default function WidgetRenderer({
    item,
    context = {},
    container = {},
    events: externalEvents = {}, // from useControlEvents
    stateEvents = {},
    state = undefined, // optional override pair {get,set}
}) {
    useSignals();
    if (!item) return null;

    const resolveItemBoundValue = (ctx, currentItem) => {
        if (!currentItem?.dataField) return undefined;
        const scope = String(currentItem?.scope || 'form').trim().toLowerCase();
        switch (scope) {
            case 'metrics':
                return resolveSelector(ctx?.signals?.metrics?.peek?.() || ctx?.signals?.metrics?.value || {}, currentItem.dataField);
            case 'windowform':
                return resolveSelector(ctx?.signals?.windowForm?.peek?.() || ctx?.signals?.windowForm?.value || {}, currentItem.dataField);
            case 'input':
                return resolveSelector(ctx?.signals?.input?.peek?.() || ctx?.signals?.input?.value || {}, currentItem.dataField);
            case 'selection': {
                const selection = ctx?.handlers?.dataSource?.getSelection?.() || ctx?.handlers?.dataSource?.peekSelection?.() || {};
                const selected = selection?.selected ?? selection?.selection ?? selection;
                return resolveSelector(selected || {}, currentItem.dataField);
            }
            case 'form':
            default:
                return resolveSelector(ctx?.handlers?.dataSource?.getFormData?.() || ctx?.signals?.form?.peek?.() || ctx?.signals?.form?.value || {}, currentItem.dataField);
        }
    };

    const resolvedDataSourceRef = resolveDynamicDataSourceRef(item, context);
    const resolvedContext = resolvedDataSourceRef ? context.Context(resolvedDataSourceRef) : context;

    // ------------------------------------------------------------------
    // 1. Resolve widget key / factory
    // ------------------------------------------------------------------
    const classifiedWidgetKey = item.widget || classify(item);
    const resolvedItemLink = resolveLinkTarget({
        linkConfig: item?.link,
        value: resolveItemBoundValue(resolvedContext, item),
        context: resolvedContext,
    });
    const widgetKey = resolvedItemLink?.kind === 'window' || item?.type === 'link'
        ? 'link'
        : classifiedWidgetKey;
    const { factory: Widget, framework } = getWidgetEntry(widgetKey);
    // ------------------------------------------------------------------
    // 2. State adapter (scope-aware)
    // ------------------------------------------------------------------
    const scope = item.scope || 'form';

    const adapterFactory = resolveStateAdapter(scope) || resolveStateAdapter('noop');
    const adapter = adapterFactory(resolvedContext, item, state);

    // ------------------------------------------------------------------
    // 3. Events mapping
    // ------------------------------------------------------------------
    const eventMap = getEventAdapter(widgetKey);
    const events = {};
    const allowedEventKeys = new Set(Object.keys(eventMap));
    for (const [evtName, builder] of Object.entries(eventMap)) {
        events[evtName] = builder({ adapter: adapter, item, context: resolvedContext });
    }



    // ------------------------------------------------------------------
    // 4. Dynamic props (readonly, custom properties, value transformations)
    // ------------------------------------------------------------------
    // Evaluate legacy stateEvents when provided (local dynamic logic)
    let dynValue = undefined;
    if (stateEvents?.onValue) {
        dynValue = stateEvents.onValue({ data: undefined, item, value: adapter.get(), context: resolvedContext });
    }
    let dynReadonlyLocal = undefined;
    if (stateEvents?.onReadonly) {
        dynReadonlyLocal = stateEvents.onReadonly({ data: undefined, item, value: adapter.get(), context: resolvedContext });
    }
    let dynPropsLocal = {};
    if (stateEvents?.onProperties) {
        dynPropsLocal = stateEvents.onProperties({ data: undefined, item, value: adapter.get(), context: resolvedContext }) || {};
    }

    const currentVal = adapter.get();

    const dynReadonlyGlobal = runDynamicEvaluators('onReadonly', { item, context: resolvedContext, value: currentVal });
    const dynDisabledGlobal = runDynamicEvaluators('onDisabled', { item, context: resolvedContext, value: currentVal });
    const validationMsg = runDynamicEvaluators('onValidate', { item, context: resolvedContext, value: currentVal });
    const dynPropsGlobal = runDynamicEvaluators('onProperties', { item, context: resolvedContext, value: adapter.get() }) || {};

    const combinedProps = { ...dynPropsGlobal, ...dynPropsLocal };

    // Merge events: if same key exists in both, chain them
    const mergedEvents = { ...events };
    for (const [k, extFn] of Object.entries(externalEvents)) {
        if (!extFn) continue;
        if (allowedEventKeys.has(k)) {
            if (mergedEvents[k]) {
                const internalFn = mergedEvents[k];
                mergedEvents[k] = (...args) => {
                    try { extFn?.(...args); } catch (e) { console.error(e); }
                    try { internalFn?.(...args); } catch (e) { console.error(e); }
                };
            } else {
                mergedEvents[k] = extFn;
            }
            continue;
        }
        // Compatibility: map stray onItemSelect into onChange when widget supports onChange.
        if (k === 'onItemSelect' && allowedEventKeys.has('onChange')) {
            const internalFn = mergedEvents.onChange;
            if (internalFn) {
                mergedEvents.onChange = (...args) => {
                    try { extFn?.(...args); } catch (e) { console.error(e); }
                    try { internalFn?.(...args); } catch (e) { console.error(e); }
                };
            } else {
                mergedEvents.onChange = (...args) => { try { extFn?.(...args); } catch (e) { console.error(e); } };
            }
        }
        // Ignore any other external event keys not supported by this widget.
    }


    const options = item.options || resolveDataSourceOptions(item, resolvedContext, adapter.getOptions())

    const baseValue = (dynValue !== undefined ? dynValue : adapter.get());
    const safeValue = widgetKey === 'label' ? baseValue : ((baseValue === null || baseValue === undefined) ? '' : baseValue);

    const widgetProps = {
        id: item.id || undefined,
        'aria-label': item.ariaLabel || item.label || undefined,
        context: resolvedContext,
        adapter: adapter,
        item,
        value: safeValue,
        readOnly:
            dynReadonlyLocal !== undefined
                ? dynReadonlyLocal
                : dynReadonlyGlobal !== undefined
                ? dynReadonlyGlobal
                : item.readOnly,
        disabled: dynDisabledGlobal === undefined ? item.disabled : dynDisabledGlobal,
        onChange: events.onChange,
        options,
        ...item.properties,
        ...combinedProps,
        ...mergedEvents,
    };

    if (item?.optionsDataSourceRef) {
        const hasResolvedValue = safeValue !== '' && safeValue !== null && safeValue !== undefined;
        widgetProps.className = [
            item?.className,
            'forge-dictionary-input',
            hasResolvedValue ? 'is-resolved' : '',
        ].filter(Boolean).join(' ');
    }


    // No need to expose unsupported event keys to the widget DOM.

    // ------------------------------------------------------------------
    // 5. Pass-through of common display properties present directly on item
    // ------------------------------------------------------------------
    ['icon', 'leftIcon', 'rightIcon', 'intent', 'appearance', 'link', 'format', 'className', 'style', 'title'].forEach((k) => {
        if (item?.[k] !== undefined && widgetProps[k] === undefined) {
            widgetProps[k] = item[k];
        }
    });
    if (resolvedItemLink && widgetProps.link === undefined) {
        widgetProps.link = item?.link;
    }





    // Visibility: allow dynamic evaluator and simple visibleWhen rule on item
    let visible = runDynamicEvaluators('onVisible', { item, context: resolvedContext, value: currentVal });
    // If not decided yet, check item-level handler mapping: onVisible → handler
    if (visible === undefined && Array.isArray(item?.on)) {
        try {
            const h = item.on.find(e => e && e.event === 'onVisible');
            if (h && typeof resolvedContext?.lookupHandler === 'function') {
                const fn = resolvedContext.lookupHandler(h.handler);
                if (typeof fn === 'function') {
                    const res = fn({ item, context: resolvedContext, value: currentVal });
                    if (typeof res === 'boolean') {
                        visible = res;
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }
    if (visible === undefined) {
        visible = item?.visibleWhen ? evaluatePlainVisibleWhen(item.visibleWhen, resolvedContext) : undefined;
    }
    if (item?.hiddenWhen && evaluatePlainVisibleWhen(item.hiddenWhen, resolvedContext)) visible = false;
    if (visible === false) return null;

    if (item?.disabledWhen && evaluatePlainVisibleWhen(item.disabledWhen, resolvedContext)) widgetProps.disabled = true;
    if (item?.readOnlyWhen && evaluatePlainVisibleWhen(item.readOnlyWhen, resolvedContext)) widgetProps.readOnly = true;

    const itemWithError = validationMsg ? { ...item, validationError: validationMsg } : item;

    if (validationMsg) {
        widgetProps.intent = 'danger';
    }
    return (
        <ControlWrapper item={itemWithError} container={container} context={resolvedContext} framework={framework} >
            <Widget { ...widgetProps} />
        </ControlWrapper>
    );
}
