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
                break;
        }

        console.log('useSignalEffect', scope, context)

        forceRender((c) => c + 1);
    });
    const adapterFactory = resolveStateAdapter(scope) || resolveStateAdapter('noop');
    const adapter = adapterFactory(context, item, state);

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

    const widgetProps = {
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
        ...events,
    };

    // pass static options array when present (used by select-like widgets)
    if (item.options && !widgetProps.options) {
        widgetProps.options = item.options;
    }

    const itemWithError = validationMsg ? { ...item, validationError: validationMsg } : item;

    if (validationMsg) {
        widgetProps.intent = 'danger';
    }

    console.log('WidgetRenderer', itemWithError, widgetProps)

    return (
        <ControlWrapper item={itemWithError} container={container} framework={framework}>
            <Widget {...widgetProps} />
        </ControlWrapper>
    );
}
