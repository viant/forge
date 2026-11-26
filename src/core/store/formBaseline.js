// All handlers for a datasource share its form signal. Keep its accepted value
// private to that signal, including when additional controls mount mid-edit.
const baselines = new WeakMap();

export function acceptedFormValue(form) {
    if (!baselines.has(form)) acceptFormValue(form, form.peek());
    const entry = baselines.get(form);
    if (!Object.hasOwn(entry, 'value')) entry.value = JSON.parse(entry.snapshot);
    return entry.value;
}

export function acceptFormValue(form, value, version) {
    baselines.set(form, {value, version});
}

export function retainedDraftBaseline(form, fallback) {
    const entry = baselines.get(form);
    if (!entry) return fallback;
    return entry.snapshot ??= JSON.stringify(entry.value || {});
}

export function retainDraftBaseline(form, snapshot, version, value) {
    if (!form || typeof form !== 'object') return;
    const entry = baselines.get(form);
    if (entry && version !== undefined && version === entry.version) return;
    baselines.set(form, value === undefined ? {snapshot, version} : {snapshot, version, value});
}
