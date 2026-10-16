// Per-datasource interaction state; it never changes authored metadata or scope.
const requests = new WeakMap();

export function usesLazyOptions(item = {}) {
    return item.optionsFetchMode === 'onFocus'
        && String(item.widget || item.type || '').toLowerCase() === 'select'
        && !!String(item.optionsDataSourceRef || '').trim()
        && !Array.isArray(item.options);
}

const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.toJSON === 'function') return canonical(value.toJSON());
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
};

export function lazyOptionsState(item, context) {
    if (!usesLazyOptions(item)) return null;
    const target = context?.Context?.(item.optionsDataSourceRef);
    const controlSignal = target?.signals?.control;
    const identity = controlSignal || target?.handlers?.dataSource;
    if (!identity || typeof identity !== 'object') return null;
    // value reads intentionally subscribe the actual renderer to completion,
    // errors and parameter changes, rather than polling or issuing another RPC.
    const control = controlSignal?.value || {};
    const input = target?.signals?.input?.value || {};
    const key = JSON.stringify(canonical({parameters: input.parameters || {}, filter: input.filter || {}}));
    let state = requests.get(identity);
    if (!state) {
        state = {key, control, loaded: control.loaded === true && !control.error,
            pending: control.loading === true, attempted: false, failed: !!control.error};
        requests.set(identity, state);
    } else {
        if (state.key !== key) {
            state.key = key;
            state.loaded = false;
            state.pending = false;
            state.attempted = false;
            state.failed = false;
        }
        if (state.control !== control) {
            if (control.loading === true) state.pending = true;
            else if (control.loaded === true || control.error) {
                state.pending = false;
                state.loaded = control.loaded === true && !control.error;
                state.failed = !!control.error;
            }
            state.control = control;
        }
    }
    return {target, control, input, state,
        current: state.loaded,
        status: state.pending || control.loading ? 'loading' : state.failed || control.error ? 'error' : state.loaded ? 'ready' : 'idle'};
}

export function requestLazyOptions(item, context, {reason = 'focus', readOnly = false, disabled = false} = {}) {
    if (readOnly || disabled) return false;
    const snapshot = lazyOptionsState(item, context);
    if (!snapshot) return false;
    const {target, control, input, state} = snapshot;
    if (state.pending || control.loading || input.fetch || state.loaded) return false;
    // Refocus/typing never silently retries a failed read. An explicit dropdown
    // open (pointer or keyboard) is the deliberate retry affordance.
    if ((state.failed || control.error) && reason !== 'open') return false;
    if (state.attempted && !state.failed && !control.error) return false;
    const fetch = target?.handlers?.dataSource?.fetchCollection;
    if (typeof fetch !== 'function') return false;
    state.pending = true;
    state.attempted = true;
    state.failed = false;
    const requestedKey = state.key;
    const failed = () => {
        if (state.key !== requestedKey) return;
        state.pending = false;
        state.failed = true;
    };
    try {
        const completion = fetch({});
        if (completion?.then) completion.catch(failed);
    } catch (_) { failed(); }
    return true;
}
