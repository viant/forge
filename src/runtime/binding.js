/* -------------------------------------------------------------------------
 * Binding helpers – registry of adapters that decouple WidgetRenderer from
 * any concrete state management or event mapping.
 * ---------------------------------------------------------------------- */

// --------------------------- State adapters ------------------------------

const stateAdapters = new Map();

/**
 * Register or override a state adapter.
 *
 * @param {string} scope  (e.g. 'form', 'filter', 'local')
 * @param {(context,item,extra?)=>{get:Function,set:Function}} adapter
 */
export function registerStateAdapter(scope, adapter) {
    stateAdapters.set(scope, adapter);
}

export function resolveStateAdapter(scope) {
    return stateAdapters.get(scope);
}

// Default no-op adapter – avoids crashes during early migration
registerStateAdapter('noop', () => ({ get: () => undefined, set: () => {}, getOptions: () => [] }));

// Local state adapter used by SchemaBasedForm or any ad-hoc component that
// wants to manage its own value object outside DataSource.
registerStateAdapter('local', (ctx, item, pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
        console.error('[binding] local adapter requires [values,setValues] pair');
        return { get: () => undefined, set: () => {} };
    }
    const [values, setValues] = pair;
    const key = item.name || item.id;
    return {
        get: () => values[key],
        getOptions: () => {
            return []
        },
        set: (v) => setValues((prev) => ({ ...prev, [key]: v })),
    };
});

/* ---------------------------------------------------------------------
 * Default "form" adapter that mirrors legacy ControlRenderer behaviour –
 * reads/writes via context.handlers.dataSource {getFormData, setFormField}.
 * ------------------------------------------------------------------ */

import { resolveSelector } from '../utils/selector.js';

registerStateAdapter('form', (ctx, item) => {
    const dsHandlers = ctx?.handlers?.dataSource;

    const fieldKey = item.dataField || item.bindingPath || item.id;
    const optionsFieldKey = item.optionsField  || fieldKey + 'Options'
    return {
        get: () => {
            const data = dsHandlers?.getFormData?.() || {};
            return resolveSelector(data, fieldKey);
        },
        getOptions: () => {
            const data = dsHandlers?.getFormData?.() || {};
            return   resolveSelector(data, optionsFieldKey) || [];
        },
        set: (v) => {
            dsHandlers?.setFormField?.({ item, value: v });
        },
    };
});

registerStateAdapter('filter', (ctx, item) => {
    const dsHandlers = ctx?.handlers?.dataSource;
    const fieldKey = item.dataField || item.bindingPath || item.id;
    return {
        get: () => {
            const data = dsHandlers?.peekFilter?.() || {};
            return resolveSelector(data, fieldKey);
        },
        getOptions: () => [],
        set: (v) => {
            dsHandlers?.setFilterValue?.({ item, value: v });
        },
    };
});

registerStateAdapter('input', (ctx, item) => {
    const fieldKey = item.dataField || item.bindingPath || item.id;
    return {
        get: () => resolveSelector(ctx?.signals?.input?.peek?.() || {}, fieldKey),
        getOptions: () => [],
        set: (v) => {
            const prev = ctx?.signals?.input?.peek?.() || {};
            if (ctx?.signals?.input) {
                ctx.signals.input.value = { ...prev, [fieldKey]: v };
            }
        },
    };
});

registerStateAdapter('selection', (ctx, item) => {
    const fieldKey = item.dataField || item.bindingPath || item.id;
    return {
        get: () => resolveSelector(ctx?.signals?.selection?.peek?.() || {}, fieldKey),
        getOptions: () => [],
        set: () => {},
    };
});

registerStateAdapter('metrics', (ctx, item) => {
    const fieldKey = item.dataField || item.bindingPath || item.id;
    return {
        get: () => resolveSelector(ctx?.signals?.metrics?.peek?.() || {}, fieldKey),
        getOptions: () => [],
        set: () => {},
    };
});

registerStateAdapter('windowForm', (ctx, item) => {
    const fieldKey = item.dataField || item.bindingPath || item.id;
    return {
        get: () => resolveSelector(ctx?.signals?.windowForm?.peek?.() || {}, fieldKey),
        getOptions: () => [],
        set: (v) => {
            const prev = ctx?.signals?.windowForm?.peek?.() || {};
            if (ctx?.signals?.windowForm) {
                ctx.signals.windowForm.value = {
                    ...prev,
                    [fieldKey]: v,
                };
            }
        },
    };
});

registerStateAdapter('collection', (ctx, item) => {
    const fieldKey = item.dataField || item.bindingPath || item.id;
    const aggregate = item.aggregate || item.properties?.aggregate || 'last';

    const get = () => {
        const rows = Array.isArray(ctx?.signals?.collection?.peek?.()) ? ctx.signals.collection.peek() : [];
        const numericValues = rows
            .map((row) => resolveSelector(row, fieldKey))
            .filter((value) => value !== undefined && value !== null && value !== '')
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));

        if (typeof aggregate === 'object' && aggregate) {
            const op = String(aggregate.op || 'last').toLowerCase();
            const window = Number(aggregate.window || 0);
            const scopedRows = window > 0 ? rows.slice(-window) : rows;
            const scopedValues = scopedRows
                .map((row) => resolveSelector(row, fieldKey))
                .filter((value) => value !== undefined && value !== null && value !== '')
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value));
            if (op === 'sum') return scopedValues.reduce((sum, value) => sum + value, 0);
            if (op === 'avg' || op === 'average') return scopedValues.length ? scopedValues.reduce((sum, value) => sum + value, 0) / scopedValues.length : undefined;
            if (op === 'last') return scopedRows.length ? resolveSelector(scopedRows[scopedRows.length - 1], fieldKey) : undefined;
        }

        const op = String(aggregate || 'last').toLowerCase();
        if (op === 'sum') return numericValues.reduce((sum, value) => sum + value, 0);
        if (op === 'avg' || op === 'average') return numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : undefined;
        if (op === 'last') return rows.length ? resolveSelector(rows[rows.length - 1], fieldKey) : undefined;
        return undefined;
    };

    return {
        get,
        getOptions: () => [],
        set: () => {},
    };
});

// --------------------------- Event adapters ------------------------------

const eventAdapters = new Map(); // key → map

export function registerEventAdapter(widgetKey, map) {
    eventAdapters.set(widgetKey, map);
}

export function getEventAdapter(widgetKey) {
    return eventAdapters.get(widgetKey) || eventAdapters.get('*') || {};
}

// ----------------------- Dynamic evaluators ------------------------------

const dynamicEvaluators = {
    onReadonly: [],
    onProperties: [],
    onValue: [],
    onDisabled: [], // permission-based disabling
    onValidate: [], // return error string/null
    onVisible: [],  // return boolean; undefined means no opinion
};

export function registerDynamicEvaluator(name, fn) {
    if (!dynamicEvaluators[name]) dynamicEvaluators[name] = [];
    dynamicEvaluators[name].push(fn);
}

export function runDynamicEvaluators(name, args) {
    const list = dynamicEvaluators[name] || [];
    for (const fn of list) {
        try {
            const res = fn(args);
            if (res !== undefined) return res;
        } catch (e) {
            console.error('[binding] dynamic evaluator error', name, e);
        }
    }
    return undefined;
}

// --------------------------- Local form helper ---------------------------

/**
 * Simple helper to wrap a React state pair into a state adapter accepted by
 * WidgetRenderer.  Intended for SchemaBasedForm; lives here so there is only
 * one implementation.
 */
export function useLocalFormAdapter(values, setValues) {
    return {
        scope: 'local',
        get: (key) => values[key],
        set: (key, v) => setValues((prev) => ({ ...prev, [key]: v })),
    };
}
