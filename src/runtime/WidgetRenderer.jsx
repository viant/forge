/* -------------------------------------------------------------------------
 * WidgetRenderer – generic control renderer (Phase 1 placeholder)
 * -------------------------------------------------------------------------
 * 1. Determine widget key via explicit item.widget → classifier().
 * 2. Resolve widget factory from registry.
 * 3. Build props using binding helpers (state adapter, event adapter, etc.).
 * 4. Render within ControlWrapper for label / span.
 * ---------------------------------------------------------------------- */

import React, { useState } from 'react';
import { useSignalEffect } from '@preact/signals-react';

import { classify } from './widgetClassifier.js';
import { getWidgetEntry } from './widgetRegistry.jsx';
import {
    resolveStateAdapter,
    getEventAdapter,
    runDynamicEvaluators,
} from './binding.js';

import ControlWrapper from './ControlWrapper.jsx';

export default function WidgetRenderer({
    item,
    context = {},
    container = {},
    events: externalEvents = {}, // from useControlEvents
    stateEvents = {},
    state = undefined, // optional override pair {get,set}
}) {
    if (!item) return null;

    // ------------------------------------------------------------------
    // 1. Resolve widget key / factory
    // ------------------------------------------------------------------
    const widgetKey = item.widget || classify(item);
    const { factory: Widget, framework } = getWidgetEntry(widgetKey);
    // ------------------------------------------------------------------
    // 2. State adapter (scope-aware)
    // ------------------------------------------------------------------
    const scope = item.scope || 'form';

    // --------------------------------------------------------------
    // 2a. Reactivity: re-render when any signal the adapter depends
    //     on changes (mainly for 'form' scope).
    // --------------------------------------------------------------

    const [, forceRender] = useState(0);

    // Re-render when the underlying signal for 'form' or other scopes changes
    useSignalEffect(() => {
        switch (scope) {
            case 'form':
                context?.signals?.form?.value; // establish dependency
                break;
            case 'selection':
                context?.signals?.selection?.value;
                break;
            default:
                context?.signals?.control?.value;
                break;
        }
        forceRender((c) => c + 1);
    });
    const adapterFactory = resolveStateAdapter(scope) || resolveStateAdapter('noop');
    const adapter = adapterFactory(context, item, state);
    console.log('mapping --- ', widgetKey, item)
    // ------------------------------------------------------------------
    // 3. Events mapping
    // ------------------------------------------------------------------
    const eventMap = getEventAdapter(widgetKey);
    const events = {};
    for (const [evtName, builder] of Object.entries(eventMap)) {
        events[evtName] = builder({ adapter, item, context });
    }

    // ------------------------------------------------------------------
    // 4. Dynamic props (readonly, custom properties, value transformations)
    // ------------------------------------------------------------------
    // Evaluate legacy stateEvents when provided (local dynamic logic)
    let dynValue = undefined;
    if (stateEvents?.onValue) {
        dynValue = stateEvents.onValue({ data: undefined, item, value: adapter.get(), context });
    }
    let dynReadonlyLocal = undefined;
    if (stateEvents?.onReadonly) {
        dynReadonlyLocal = stateEvents.onReadonly({ data: undefined, item, value: adapter.get(), context });
    }
    let dynPropsLocal = {};
    if (stateEvents?.onProperties) {
        dynPropsLocal = stateEvents.onProperties({ data: undefined, item, value: adapter.get(), context }) || {};
    }

    const currentVal = adapter.get();

    const dynReadonlyGlobal = runDynamicEvaluators('onReadonly', { item, context, value: currentVal });
    const dynDisabledGlobal = runDynamicEvaluators('onDisabled', { item, context, value: currentVal });
    const validationMsg = runDynamicEvaluators('onValidate', { item, context, value: currentVal });
    const dynPropsGlobal = runDynamicEvaluators('onProperties', { item, context, value: adapter.get() }) || {};

    const combinedProps = { ...dynPropsGlobal, ...dynPropsLocal };

    // Merge events: if same key exists in both, chain them
    const mergedEvents = { ...events };
    for (const [k, extFn] of Object.entries(externalEvents)) {
        if (mergedEvents[k]) {
            const internalFn = mergedEvents[k];
            mergedEvents[k] = (...args) => {
                try { extFn?.(...args); } catch (e) { console.error(e); }
                try { internalFn?.(...args); } catch (e) { console.error(e); }
            };
        } else {
            mergedEvents[k] = extFn;
        }
    }

    const widgetProps = {
        context,
        adapter,
        item,
        value: dynValue !== undefined ? dynValue : adapter.get(),
        readOnly:
            dynReadonlyLocal !== undefined
                ? dynReadonlyLocal
                : dynReadonlyGlobal !== undefined
                ? dynReadonlyGlobal
                : item.readOnly,
        disabled: dynDisabledGlobal === undefined ? undefined : dynDisabledGlobal,
        onChange: events.onChange,
        ...item.properties,
        ...combinedProps,
        ...mergedEvents,
    };

    // Compatibility: when a widget supplies only `onChange` handler but the
    // event adapter produced `onItemSelect`, map it.
    if (!widgetProps.onChange && mergedEvents.onItemSelect) {
        widgetProps.onChange = mergedEvents.onItemSelect;
    }

    // ------------------------------------------------------------------
    // 5. Pass-through of common display properties present directly on item
    // ------------------------------------------------------------------
    ['icon', 'leftIcon', 'rightIcon', 'intent'].forEach((k) => {
        if (item?.[k] !== undefined && widgetProps[k] === undefined) {
            widgetProps[k] = item[k];
        }
    });


    // pass static options array when present (used by select-like widgets)
    if (item.options && !widgetProps.options) {
        widgetProps.options = item.options;
    }

    const itemWithError = validationMsg ? { ...item, validationError: validationMsg } : item;

    if (validationMsg) {
        widgetProps.intent = 'danger';
    }
    return (
        <ControlWrapper item={itemWithError} container={container} framework={framework} >
            <Widget { ...widgetProps} />
        </ControlWrapper>
    );
}
