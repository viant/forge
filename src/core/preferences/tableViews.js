import {validateTablePreferenceKey, validateTablePreferences} from './tablePreferences.js';

// Producer-specific wire formats and column aliases belong in the host adapter.
export function validateTableView(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid table view');
    const {id, name, preferences} = value;
    if (!(typeof id === 'string' && id.length > 0 || Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid table view identity');
    if (typeof name !== 'string' || name === '') throw new Error('Table view name is required');
    return {id, name, preferences: validateTablePreferences(preferences)};
}

// One actor/key-scoped session. The host creates a new adapter on actor changes.
// All operations share a queue, including reads, so a reload observes prior writes.
export function createTableViewSession(adapter, key, onState = () => {}) {
    validateTablePreferenceKey(key);
    let disposed = false, revision = 0, queue = Promise.resolve();
    let state = {views: [], loading: false, error: null};
    const emit = patch => {
        state = {...state, ...patch};
        if (!disposed) onState(state);
    };
    const enqueue = operation => {
        if (disposed) return Promise.resolve(false);
        const current = ++revision;
        emit({loading: true, error: null});
        const task = queue.catch(() => {}).then(operation);
        queue = task;
        return task.then(patch => {
            if (!disposed && current === revision) emit({...patch, loading: false, error: null});
            return true;
        }, error => {
            if (!disposed && current === revision) emit({loading: false, error});
            return false;
        });
    };
    const list = async () => {
        const result = await adapter.list(key);
        if (!Array.isArray(result)) throw new Error('Invalid table views response');
        const views = result.map(validateTableView);
        if (new Set(views.map(view => String(view.id))).size !== views.length) throw new Error('Duplicate table view identity');
        return {views};
    };
    return {
        load: () => enqueue(list),
        save({id, name, preferences}) {
            if (typeof name !== 'string' || name === '') throw new Error('Table view name is required');
            const input = {name, preferences: validateTablePreferences(preferences)};
            if (id !== undefined) input.id = validateTableView({id, ...input}).id;
            return enqueue(async () => {
                await adapter.save(key, input);
                return list();
            });
        },
        remove(id) {
            validateTableView({id, name: 'view', preferences: {version: 1, columns: []}});
            return enqueue(async () => {
                await adapter.remove(key, id);
                return list();
            });
        },
        dispose() {disposed = true;},
    };
}
