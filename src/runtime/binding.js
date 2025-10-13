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
