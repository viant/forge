/* -------------------------------------------------------------------------
 * Widget Classifier – chooses the widget key for a control descriptor.
 * -------------------------------------------------------------------------
 * A **classifier** is a function (item) => string | undefined.  Multiple
 * classifiers can be registered with a priority; they are evaluated in order
 * until one returns a non-empty string.
 * ---------------------------------------------------------------------- */

const classifiers = [];

// ---------------------------------------------------------------------
// Link classifier – format:"uri" + default starting with http/https → link
// Higher priority (50) so it overrides the generic classifier below.
// ---------------------------------------------------------------------

registerClassifier(
    (item) => {
        try {
            if (
                item?.format === 'uri' &&
                typeof item?.default === 'string' &&
                /^https?:\/\//i.test(item.default)
            ) {
                return 'link';
            }
        } catch {}
        return undefined;
    },
    { priority: 50 },
);

// ---------------------------------------------------------------------
// Date / Date-time classifier – maps JSON-schema formats to widgets
// ---------------------------------------------------------------------

registerClassifier(
    (item) => {
        try {
            if (!item) return undefined;
            switch (item.format) {
                case 'json':
                    return 'object';
                case 'password':
                    return 'password';
                case 'date':
                    return 'date';
                case 'date-time':
                case 'datetime':
                    return 'datetime';
                case 'markdown':
                    return 'markdown';
                default:
                    return undefined;
            }
        } catch {
            /* ignore */
        }
        return undefined;
    },
    { priority: 60 },
);

// ---------------------------------------------------------------------
// Object classifier – plain JSON data
// ---------------------------------------------------------------------

registerClassifier((item) => {
    if (item?.type === 'object') return 'object';
    if (item?.type === 'schema') return 'schema';
    if (item?.type === 'markdown') return 'markdown';
    if (item?.type === 'document') return 'document';
}, { priority: 70 });

/**
 * Register a classifier.
 *
 * @param {(item:object)=>string|undefined} fn
 * @param {{priority?:number}} [options]
 */
export function registerClassifier(fn, { priority = 100 } = {}) {
    classifiers.push({ fn, priority });
    classifiers.sort((a, b) => a.priority - b.priority);
}

/**
 * Run classifiers to find a widget key.
 */
export function classify(item) {
    console.assert(item, 'classify requires a non-null item');
    if (item && item.widget) return item.widget; // explicit override

    for (const { fn } of classifiers) {
        try {
            const res = fn(item);
            if (typeof res === 'string' && res) return res;
        } catch (e) {
            console.error('[widgetClassifier] classifier error', e);
        }
    }
    return 'input'; // fallback key
}

/* ---------------------------------------------------------------------
 * Default classifier replicating legacy ControlRenderer heuristics.
 * ------------------------------------------------------------------ */

registerClassifier((item) => {
    if (!item) return undefined;

    // enum → select
    if (Array.isArray(item.enum) && item.enum.length > 0) return 'select';

    switch (item.type) {
        case 'number':
        case 'numeric':
        case 'integer':
            return 'number';
        case 'checkbox':
            return 'checkbox';
        case 'toggle':
            return 'toggle';
        case 'textarea':
            return 'textarea';
        case 'password':
            return 'password';
        case 'currency':
            return 'currency';
        case 'date':
            return 'date';
        case 'datetime':
            return 'datetime';
        case 'radio':
            return 'radio';
        case 'select':
        case 'dropdown':
            return 'select';
        case 'multiSelect':
        case 'multiselect':
            return 'multiSelect';
        case 'label':
            return 'label';
        case 'progressBar':
            return 'progressBar';
        case 'math':
            return 'math';
        case 'object':
            return 'object';
        case 'schema':
            return 'schema';
        case 'button':
            return 'button';
        default:
            return 'text';
    }
}, { priority: 100 });
