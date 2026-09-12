const validID = value => typeof value === 'string' && value.trim().length > 0 && [...value].length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);
export const MAX_TABLE_PREFERENCE_BYTES = 64 * 1024;
const assertPayloadSize = value => {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_TABLE_PREFERENCE_BYTES) throw new Error('Table preferences exceed 64 KiB');
};
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : undefined;

export function sanitizeTablePreferences(input) {
    if (!input || typeof input !== 'object' || input.version !== 1) throw new Error('Unsupported table preferences');
    const seen = new Set();
    const columns = (Array.isArray(input.columns) ? input.columns : []).slice(0, 256).flatMap(column => {
        if (!column || !validID(column.id) || seen.has(column.id)) return [];
        seen.add(column.id);
        const clean = {id: column.id};
        if (typeof column.visible === 'boolean') clean.visible = column.visible;
        if (typeof column.width === 'number' && Number.isFinite(column.width)) clean.width = Math.max(24, Math.min(4096, column.width));
        for (const [key, limit] of [['displayName', 256], ['tooltip', 1024]]) {
            const value = text(column[key], limit);
            if (value !== undefined) clean[key] = value;
        }
        if (['left', 'center', 'right'].includes(column.align)) clean.align = column.align;
        return [clean];
    });
    const result = {version: 1, columns};
    if (input.sort && validID(input.sort.columnId) && ['asc', 'desc'].includes(input.sort.direction)) result.sort = {columnId: input.sort.columnId, direction: input.sort.direction};
    if (['compact', 'normal'].includes(input.density)) result.density = input.density;
    if (Array.isArray(input.frozenColumnIds)) result.frozenColumnIds = [...new Set(input.frozenColumnIds.filter(validID))].slice(0, 256);
    assertPayloadSize(result);
    return result;
}

export function applyTableColumnPreferences(source = [], preferences) {
    if (!preferences) return source;
    const saved = sanitizeTablePreferences(preferences);
    const sourceById = new Map(source.map(column => [column.id, column]));
    const used = new Set();
    const ordered = [];
    for (const preference of saved.columns) {
        const column = sourceById.get(preference.id);
        if (!column) continue;
        used.add(column.id);
        ordered.push({...column, ...preference, visible: column.nonExcludable ? true : preference.visible ?? column.visible});
    }
    for (const column of source) if (!used.has(column.id)) ordered.push(column);
    if (!saved.frozenColumnIds) return ordered;
    const frozen = new Set(saved.frozenColumnIds);
    return ordered.map(column => ({...column, sticky: frozen.has(column.id) ? 'left' : false}));
}

export function createBrowserTablePreferences({storage = () => globalThis.localStorage, prefix = 'forge.table.preferences.v1:', namespace = '', migrateLegacy = !namespace} = {}) {
    const scopedPrefix = namespace ? `${prefix}${encodeURIComponent(namespace)}:` : prefix;
    const tails = new Map();
    const resolveStorage = () => {
        const value = typeof storage === 'function' ? storage() : storage;
        if (!value) throw new Error('Browser preference storage is unavailable');
        return value;
    };
    const enqueue = (key, work) => {
        const next = (tails.get(key) || Promise.resolve()).catch(() => {}).then(work);
        tails.set(key, next);
        next.finally(() => {if (tails.get(key) === next) tails.delete(key);}).catch(() => {});
        return next;
    };
    return {
        async get(key) {
            validateTablePreferenceKey(key);
            if (tails.has(key)) await tails.get(key);
            const store = resolveStorage();
            const current = store.getItem(scopedPrefix + key);
            if (current != null) return validateTablePreferences(JSON.parse(current));
            if (!migrateLegacy) return null;
            const legacy = store.getItem(key);
            if (legacy == null) return null;
            const parsed = JSON.parse(legacy);
            if (!Array.isArray(parsed)) throw new Error('Invalid legacy table preferences');
            const migrated = sanitizeTablePreferences({version: 1, columns: parsed});
            await enqueue(key, () => {store.setItem(scopedPrefix + key, JSON.stringify(migrated));store.removeItem(key);});
            return migrated;
        },
        set(key, preferences) {
            validateTablePreferenceKey(key);
            const clean = sanitizeTablePreferences(preferences);
            return enqueue(key, () => resolveStorage().setItem(scopedPrefix + key, JSON.stringify(clean)));
        },
        reset(key) {
            validateTablePreferenceKey(key);
            return enqueue(key, () => {const store = resolveStorage();store.removeItem(scopedPrefix + key);if(migrateLegacy)store.removeItem(key);});
        },
    };
}

export const browserTablePreferences = createBrowserTablePreferences();

export function validateTablePreferenceKey(key) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 512) throw new Error('Invalid table preference key');
    return key;
}

export function validateTablePreferences(value) {
    assertPayloadSize(value);
    const allowed = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
    if (!allowed(value, ['version','columns','sort','density','frozenColumnIds']) || value.version !== 1 || !Array.isArray(value.columns) || value.columns.length > 256) throw new Error('Invalid table preferences');
    const ids = new Set();
    for (const column of value.columns) {
        if (!allowed(column, ['id','visible','width','displayName','align','tooltip']) || !validID(column.id) || ids.has(column.id)) throw new Error('Invalid column preferences');
        ids.add(column.id);
        if (column.visible !== undefined && typeof column.visible !== 'boolean') throw new Error('Invalid visibility');
        if (column.width !== undefined && (typeof column.width !== 'number' || !Number.isFinite(column.width) || column.width < 24 || column.width > 4096)) throw new Error('Invalid column width');
        for (const [key,max] of [['displayName',256],['tooltip',1024]]) if (column[key] !== undefined && (typeof column[key] !== 'string' || column[key].length > max)) throw new Error('Invalid column text');
        if (column.align !== undefined && !['left','center','right'].includes(column.align)) throw new Error('Invalid alignment');
    }
    if (value.sort !== undefined && (!allowed(value.sort,['columnId','direction']) || !validID(value.sort.columnId) || !['asc','desc'].includes(value.sort.direction))) throw new Error('Invalid sort');
    if (value.density !== undefined && !['compact','normal'].includes(value.density)) throw new Error('Invalid density');
    if (value.frozenColumnIds !== undefined && (!Array.isArray(value.frozenColumnIds) || value.frozenColumnIds.length > 256 || !value.frozenColumnIds.every(validID) || new Set(value.frozenColumnIds).size !== value.frozenColumnIds.length)) throw new Error('Invalid frozen columns');
    return sanitizeTablePreferences(value);
}

// One mounted table session: stale reads never undo user edits; writes and reset
// run in order against the captured key, even if the UI later changes scope.
export function createTablePreferenceSession(adapter, key, onState = () => {}) {
    validateTablePreferenceKey(key);
    let disposed = false, revision = 0, queue = Promise.resolve();
    let state = {preferences:null, loading:false, error:null};
    const emit = patch => {state={...state,...patch};if(!disposed)onState(state);};
    const persist = (action, currentRevision) => {
        const task = queue.catch(()=>{}).then(action);
        queue = task;
        return task.then(()=>{if(!disposed && currentRevision===revision)emit({error:null});return true;},error=>{if(!disposed && currentRevision===revision)emit({error});return false;});
    };
    return {
        async load() {
            const currentRevision=revision;
            emit({loading:true,error:null});
            try {
                const result=await adapter.get(key);
                const preferences=result==null ? null : validateTablePreferences(result);
                if(!disposed && currentRevision===revision)emit({preferences,loading:false,error:null});
            }catch(error){if(!disposed && currentRevision===revision)emit({loading:false,error});}
        },
        save(value) {
            const preferences=sanitizeTablePreferences(value);
            const currentRevision=++revision;
            emit({preferences,loading:false,error:null});
            return persist(()=>adapter.set(key,preferences),currentRevision);
        },
        reset() {
            const currentRevision=++revision;
            emit({preferences:null,loading:false,error:null});
            return persist(()=>adapter.reset(key),currentRevision);
        },
        dispose(){disposed=true;},
    };
}
