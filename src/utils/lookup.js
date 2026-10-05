import { resolveSelector, setSelector } from './selector.js';
import { getLogger } from './logger.js';

// Open a lookup dialog defined in item.lookup and apply outputs when user picks
// a record. Works only when lookup metadata present.

const log = getLogger('lookup');

export function normalizeLookupInputs(inputs = [], targetDataSource = '') {
    const target = String(targetDataSource || '').trim();
    return inputs.map((p) => ({
        ...p,
        from: p.from || ':form',
        to: (() => {
            const destination = p.to || ':query';
            if (!target || !String(destination).startsWith(':')) return destination;
            // Lookup targets are Forge datasource refs, whose fetch contract
            // consumes the parameters store. `:query` remains the concise
            // metadata spelling, while an explicitly qualified destination
            // retains its caller-selected store.
            return String(destination) === ':query'
                ? `${target}:parameters`
                : `${target}${destination}`;
        })(),
    }));
}

export function normalizeLookupOutputs(outputs = []) {
    return outputs.map((p) => ({
        ...p,
        from: p.from || ':output',
        to: p.to || ':form',
    }));
}

export function unwrapLookupRecord(record) {
    if (record == null || record?.cancelled === true || record?.canceled === true) return null;
    if (Array.isArray(record)) return unwrapLookupRecord(record[0]);
    if (typeof record !== 'object') return record;
    if (Object.prototype.hasOwnProperty.call(record, 'selected')) {
        return unwrapLookupRecord(record.selected);
    }
    if (Array.isArray(record.selection) && record.selection.length > 0) {
        const first = record.selection[0];
        return unwrapLookupRecord(first);
    }
    if (Object.prototype.hasOwnProperty.call(record, 'row')) return unwrapLookupRecord(record.row);
    return record;
}

export class LookupUnavailableError extends Error {
    constructor(message = 'Lookup selection is unavailable in this workspace.') {
        super(message);
        this.name = 'LookupUnavailableError';
        this.code = 'LOOKUP_UNAVAILABLE';
    }
}

function isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

export function buildLookupRequest({ item, context, value, signal } = {}) {
    const source = item?.lookup || {};
    const dataSourceRef = String(source.dataSourceRef || source.dataSource || '').trim();
    const inputs = Array.isArray(source.inputs)
        ? normalizeLookupInputs(source.inputs, dataSourceRef)
        : (source.inputs && typeof source.inputs === 'object' ? {...source.inputs} : []);
    const outputs = normalizeLookupOutputs(Array.isArray(source.outputs) ? source.outputs : []);
    return {
        lookup: {
            ...source,
            ...(dataSourceRef ? { dataSource: dataSourceRef, dataSourceRef } : {}),
            inputs,
            outputs,
        },
        item,
        value,
        inputs,
        outputs,
        signal,
        context,
    };
}

/**
 * Ask the active host to select a lookup row. Hosts return the untouched row,
 * while Forge owns unwrapping legacy dialog envelopes and cancellation.
 */
export async function requestLookupSelection({ item, context, value, signal } = {}) {
    if (!item?.lookup) return null;
    if (signal?.aborted) return null;

    const request = buildLookupRequest({ item, context, value, signal });
    const { lookup } = request;
    const lookupOpen = context?.handlers?.lookup?.open;
    let result;

    try {
        if (typeof lookupOpen === 'function') {
            result = await lookupOpen(request);
        } else if (lookup.dialogId && typeof context?.handlers?.window?.openDialog === 'function') {
            const parameters = Array.isArray(lookup.inputs) ? lookup.inputs : [];
            result = await context.handlers.window.openDialog({
                execution: {
                    args: [lookup.dialogId, {
                        awaitResult: true,
                        multiple: false,
                        parameters,
                        signal,
                    }],
                    parameters,
                },
                context,
            });
        } else if (lookup.windowId && typeof context?.handlers?.window?.openWindow === 'function') {
            const parameters = Array.isArray(lookup.inputs) ? lookup.inputs : [];
            const options = {
                awaitResult: true,
                parameters,
                modal: true,
                signal,
            };
            for (const key of ['size', 'width', 'height', 'footer']) {
                if (lookup[key] !== undefined) options[key] = lookup[key];
            }
            result = await context.handlers.window.openWindow({
                execution: {
                    args: [lookup.windowId, lookup.title || '', '', false, options],
                    parameters,
                },
                context,
            });
        } else {
            throw new LookupUnavailableError();
        }
    } catch (error) {
        if (signal?.aborted || isAbortError(error)) return null;
        throw error;
    }

    if (signal?.aborted) return null;
    return unwrapLookupRecord(result);
}

function outputSelectors(output = {}) {
    const source = String(output.location || output.selector || output.name || '').trim();
    const target = String(output.name || output.target || output.location || '').trim();
    return { source, target };
}

export function mergeLookupPatch(values = {}, patch = {}) {
    if (!patch || typeof patch !== 'object') return { ...(values || {}) };
    let merged = { ...(values || {}) };
    const visit = (object, prefix = '') => {
        Object.entries(object || {}).forEach(([key, next]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (next && typeof next === 'object' && !Array.isArray(next)) visit(next, path);
            else merged = setSelector(merged, path, next);
        });
    };
    visit(patch);
    return merged;
}

/** Map raw row selectors to form selectors without mutating either object. */
export function mapLookupSelection({ item, outputs = item?.lookup?.outputs || [], record } = {}) {
    const selected = unwrapLookupRecord(record);
    if (!selected || typeof selected !== 'object') return {};

    let patch = {};
    const normalized = normalizeLookupOutputs(Array.isArray(outputs) ? outputs : []);
    normalized.forEach((output) => {
        if (output.to !== ':form') return;
        const { source, target } = outputSelectors(output);
        if (!source || !target) return;
        const next = resolveSelector(selected, source);
        if (next !== undefined) patch = setSelector(patch, target, next);
    });

    if (normalized.length === 0) {
        const fieldKey = String(item?.dataField || item?.bindingPath || item?.name || item?.id || '').trim();
        const valueSelector = String(item?.lookup?.valueField || fieldKey).trim();
        const next = resolveSelector(selected, valueSelector);
        if (fieldKey && next !== undefined) patch = setSelector(patch, fieldKey, next);
    }
    return patch;
}

export function writeLookupFormValues({ context, values } = {}) {
    const handlers = context?.handlers?.dataSource;
    if (typeof handlers?.setEditedFormData === 'function') {
        handlers.setEditedFormData({ values });
        return true;
    }
    if (typeof handlers?.setFormData === 'function') {
        handlers.setFormData({ values });
        return true;
    }
    const formSignal = context?.signals?.form;
    if (formSignal) {
        formSignal.value = values;
        return true;
    }
    return false;
}

function lookupDisplayValue(item, record, patch) {
    const selector = String(item?.lookup?.display || '').trim();
    if (!selector) return undefined;
    if (!selector.includes('${')) return resolveSelector(record, selector);
    const merged = mergeLookupPatch(record, patch);
    return selector.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const next = resolveSelector(merged, String(path).trim());
        return next == null ? '' : String(next);
    }).trim();
}

export function applyLookupSelection({ item, context, adapter, outputs = [], record }) {
    const formSignal = context?.signals?.form;
    const dataSourceHandlers = context?.handlers?.dataSource;
    const currentForm = dataSourceHandlers?.getFormData?.() || formSignal?.peek?.();
    if (!currentForm || typeof currentForm !== 'object') {
        try { console.error('[lookup] form signal not found in context', { fieldId: item?.id }); } catch (_) {}
        return null;
    }

    const normalizedOutputs = normalizeLookupOutputs(outputs);
    const patch = mapLookupSelection({ item, outputs: normalizedOutputs, record });
    let formObj = mergeLookupPatch(currentForm, patch);
    log.debug('form (before)', formObj);

    const fieldKey = item?.dataField || item?.bindingPath || item?.id;
    const rawDisplay = lookupDisplayValue(item, record, patch);
    const fieldReceivesMappedValue = normalizedOutputs.some((output) => {
        const {target} = outputSelectors(output);
        return output.to === ':form' && target === fieldKey;
    });
    if (!fieldReceivesMappedValue && rawDisplay !== undefined && rawDisplay !== null) {
        const display = Array.isArray(rawDisplay) ? rawDisplay.join(' / ') : rawDisplay;
        if (fieldKey) {
            formObj = setSelector(formObj, fieldKey, display);
        }
    }

    let selfVal = resolveSelector(formObj, fieldKey);
    if (selfVal === undefined && fieldKey !== item.id) selfVal = resolveSelector(formObj, item.id);
    if (selfVal === undefined) {
        const firstOut = normalizedOutputs.find((entry) => entry.to === ':form') || normalizedOutputs[0];
        if (firstOut) {
            try {
                const { source } = outputSelectors(firstOut);
                if (source) {
                    const fallback = resolveSelector(record, source);
                    if (fallback !== undefined) {
                        formObj = setSelector(formObj, fieldKey, fallback);
                        selfVal = fallback;
                    }
                }
            } catch (_) { /* ignore */ }
        }
    }
    log.debug('mapped', { selfVal, fieldId: item?.id, formObj });
    if (selfVal !== undefined) {
        log.debug('adapter.set', { fieldId: item?.id, value: selfVal });
        adapter?.set?.(selfVal);
    }

    log.debug('form (after)', formObj);
    if (!writeLookupFormValues({ context, values: formObj })) {
        try { console.error('[lookup] form writer not found in context', { fieldId: item?.id }); } catch (_) {}
        return null;
    }
    const applied = { form: formObj, value: selfVal };
    const callback = Array.isArray(item?.on) ? item.on.find((entry) => entry?.event === 'onLookup') : null;
    if (callback?.handler && typeof context?.lookupHandler === 'function') {
        try {
            context.lookupHandler(callback.handler)?.({item, context, value: selfVal, record, applied});
        } catch (error) {
            console.error('[lookup] onLookup handler failed', error);
        }
    }
    return applied;
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

export async function openLookup({ item, context, adapter, value, signal }) {
    if (!item?.lookup) return;
    log.debug('open', {
        fieldId: item?.id,
        dialogId: item.lookup.dialogId,
        windowId: item.lookup.windowId,
        seed: value,
    });
    const selected = await requestLookupSelection({ item, context, value, signal });
    log.debug('result', selected);
    if (!selected) return null;
    return applyLookupSelection({
        item,
        context,
        adapter,
        outputs: item.lookup.outputs || [],
        record: selected,
    });
}
