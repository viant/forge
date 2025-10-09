import { mapParameters } from './parameterMapper.js';
import { resolveSelector } from './selector.js';
import { getLogger } from './logger.js';

// Open a lookup dialog defined in item.lookup and apply outputs when user picks
// a record. Works only when lookup metadata present.

const log = getLogger('lookup');

export async function openLookup({ item, context, adapter, value }) {
    if (!item?.lookup) return;

    let { dialogId, windowId, title, inputs = [], outputs = [], size, width, height, footer } = item.lookup;

    log.debug('open', { fieldId: item?.id, dialogId, windowId, title, seed: value });

    // ------------------------------------------------------------------
    // 1. Apply defaults to Parameter objects so users can omit boilerplate
    //    • inputs: default from=:form  to=:query
    //    • outputs: default from=:output to=:form
    // ------------------------------------------------------------------

    inputs = inputs.map((p) => ({
        ...p,
        from: p.from || ':form',
        to: p.to || ':query',
    }));

    outputs = outputs.map((p) => ({
        ...p,
        from: p.from || ':output',
        to: p.to || ':form',
    }));
    // Prefer dialogId when provided; fallback to windowId for regular window
    if (!dialogId && !windowId) {
        console.error('lookup requires dialogId or windowId');
        return;
    }

    // Build parameter definitions for inbound mapping
    const paramDefs = [...inputs];

    let record = null;
    if (dialogId) {
        // Route to dialog: await result and pass parameter definitions so
        // openDialog resolves args for cycle-safe fetch on open.
        const execArgs = [dialogId, { awaitResult: true, parameters: paramDefs }];
        record = await context.handlers.window.openDialog({ execution: { args: execArgs, parameters: paramDefs }, context });
    } else {
        // Route to regular window opened as a modal-style floating overlay.
        // openWindow will resolve inbound inputs and seed DS parameters.
        const opts = { awaitResult: true, parameters: paramDefs, modal: true };
        if (size) opts.size = size;
        if (width) opts.width = width;
        if (height) opts.height = height;
        if (footer) opts.footer = footer;
        const execArgs = [windowId, title || '', '', false, opts];
        record = await context.handlers.window.openWindow({ execution: { args: execArgs, parameters: paramDefs }, context });
    }

    log.debug('result (raw)', record);
    if (!record) return;
    // Unwrap common selection shapes {selected: row} or {selection: [...]} → first element
    if (record && typeof record === 'object') {
        if (record.selected) {
            record = record.selected;
        } else if (Array.isArray(record.selection) && record.selection.length > 0) {
            const first = record.selection[0];
            record = first?.selected || first;
        }
    }

    // Apply outputs: targetData is the caller form (context.signals.form)
    const formSignal = context?.signals?.form;
    if (!formSignal) {
        try { console.error('[lookup] form signal not found in context', { fieldId: item?.id }); } catch (_) {}
        return;
    }

    const formObj = { ...formSignal.peek() };
    log.debug('form (before)', formObj);

    // Separate params targeting :form vs others (future extension)
    const formParams = outputs.filter((p) => p.to === ':form');
    mapParameters(formParams, record, formObj);

    // Ensure input's own field updated for display; if mapping did not
    // produce a value, fall back to resolving from the first output def.
    let selfVal = formObj[item.id];
    if (selfVal === undefined) {
        const firstOut = formParams[0] || outputs[0];
        if (firstOut) {
            try {
                const loc = firstOut.location || firstOut.name;
                if (loc) {
                    const fallback = resolveSelector(record, loc);
                    if (fallback !== undefined) {
                        formObj[item.id] = fallback;
                        selfVal = fallback;
                    }
                }
            } catch (_) { /* ignore */ }
        }
    }
    log.debug('mapped', { selfVal, fieldId: item?.id, formObj });
    if (selfVal !== undefined) {
        log.debug('adapter.set', { fieldId: item?.id, value: selfVal });
        adapter.set(selfVal);
    }

    log.debug('form (after)', formObj);
    formSignal.value = formObj;
}
