import { mapParameters } from './parameterMapper.js';
import { resolveSelector } from './selector.js';

// Open a lookup dialog defined in item.lookup and apply outputs when user picks
// a record. Works only when lookup metadata present.

export async function openLookup({ item, context, adapter }) {
    if (!item?.lookup) return;

    let { windowId, title, inputs = [], outputs = [] } = item.lookup;

    // ------------------------------------------------------------------
    // 1. Apply defaults to Parameter objects so users can omit boilerplate
    //    • inputs: default from=:form  to=:query
    //    • outputs: default from=:output to=:form
    // ------------------------------------------------------------------

    inputs = inputs.map((p) => ({
        from: p.from || ':form',
        to: p.to || ':query',
        ...p,
    }));

    outputs = outputs.map((p) => ({
        from: p.from || ':output',
        to: p.to || ':form',
        ...p,
    }));
    if (!windowId) {
        console.error('lookup.windowId missing');
        return;
    }

    // Build parameters array for inputs using Parameter mapping util
    const paramObj = {};
    // Source data is caller context (form, selection etc.) – mapParameters
    // will resolve selectors when we serialize; here we just pass definitions
    // through because openDialog expects raw Parameter objects.

    const execArgs = [windowId, title || '', { awaitResult: true, parameters: inputs }];

    const record = await context.handlers.window.openDialog({
        execution: { args: execArgs },
    });

    if (!record) return;

    // Apply outputs: targetData is the caller form (context.signals.form)
    const formSignal = context?.signals?.form;
    if (!formSignal) {
        console.error('form signal not found in context');
        return;
    }

    const formObj = { ...formSignal.peek() };

    // Separate params targeting :form vs others (future extension)
    const formParams = outputs.filter((p) => p.to === ':form');
    mapParameters(formParams, record, formObj);

    // Ensure input's own field updated for display
    const selfVal = formObj[item.id];
    if (selfVal !== undefined) adapter.set(selfVal);

    formSignal.value = formObj;
}
