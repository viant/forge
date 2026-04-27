import { mapParameters } from './parameterMapper.js';
import { resolveSelector } from './selector.js';
import { getLogger } from './logger.js';

// Open a lookup dialog defined in item.lookup and apply outputs when user picks
// a record. Works only when lookup metadata present.

const log = getLogger('lookup');

function normalizeLookupInputs(inputs = []) {
    return inputs.map((p) => ({
        ...p,
        from: p.from || ':form',
        to: p.to || ':query',
    }));
}

function normalizeLookupOutputs(outputs = []) {
    return outputs.map((p) => ({
        ...p,
        from: p.from || ':output',
        to: p.to || ':form',
    }));
}

function unwrapLookupRecord(record) {
    if (!record || typeof record !== 'object') return record;
    if (record.selected) return record.selected;
    if (Array.isArray(record.selection) && record.selection.length > 0) {
        const first = record.selection[0];
        return first?.selected || first;
    }
    return record;
}

export function applyLookupSelection({ item, context, adapter, outputs = [], record }) {
    const formSignal = context?.signals?.form;
    if (!formSignal) {
        try { console.error('[lookup] form signal not found in context', { fieldId: item?.id }); } catch (_) {}
        return null;
    }

    const normalizedOutputs = normalizeLookupOutputs(outputs);
    const formObj = { ...formSignal.peek() };
    log.debug('form (before)', formObj);

    const formParams = normalizedOutputs.filter((p) => p.to === ':form');
    mapParameters(formParams, record, formObj);

    let selfVal = formObj[item.id];
    if (selfVal === undefined) {
        const firstOut = formParams[0] || normalizedOutputs[0];
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
    return { form: formObj, value: selfVal };
}

export async function resolveLookupValue({ item, value }) {
    const dataSource = String(item?.lookup?.dataSource || '').trim();
    const resolveInput = String(item?.lookup?.resolveInput || '').trim();
    const raw = value == null ? '' : String(value).trim();
    if (!dataSource || !resolveInput || !raw) return null;

    const res = await fetch(`/v1/api/datasources/${encodeURIComponent(dataSource)}/fetch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            inputs: {
                [resolveInput]: raw,
            },
        }),
    });
    if (!res.ok) {
        throw new Error(`lookup resolve failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) return null;
    if (rows.length > 1) {
        throw new Error(`lookup resolve expected 1 row, got ${rows.length}`);
    }
    return rows[0];
}

export async function openLookup({ item, context, adapter, value }) {
    if (!item?.lookup) return;

    let { dialogId, windowId, title, inputs = [], outputs = [], size, width, height, footer } = item.lookup;

    log.debug('open', { fieldId: item?.id, dialogId, windowId, title, seed: value });

    // ------------------------------------------------------------------
    // 1. Apply defaults to Parameter objects so users can omit boilerplate
    //    • inputs: default from=:form  to=:query
    //    • outputs: default from=:output to=:form
    // ------------------------------------------------------------------

    inputs = normalizeLookupInputs(inputs);
    outputs = normalizeLookupOutputs(outputs);
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
    const selected = unwrapLookupRecord(record);
    if (!selected) return;
    applyLookupSelection({ item, context, adapter, outputs, record: selected });
}
