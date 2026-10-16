import {resolveSelector} from '../utils/selector.js';
import {computed} from '@preact/signals-react';

const formFieldSignals = new WeakMap();
export function formFieldValue(context, key) {
    const form = context?.signals?.form;
    if (!form || typeof form.subscribe !== 'function') return resolveSelector(context?.handlers?.dataSource?.getFormData?.() || {}, key);
    if (!key) return form.value;
    let fields = formFieldSignals.get(form);
    if (!fields) { fields = new Map(); formFieldSignals.set(form, fields); }
    if (!fields.has(key)) fields.set(key, computed(() => resolveSelector(form.value || {}, key)));
    return fields.get(key).value;
}

