/** * Resolve template string
 * @param template
 * @param context
 * @returns {*|string}
 */
export const resolveTemplate = (template, context) => {
    if (typeof template !== 'string') {
        return template;
    }
    const regex = /\${([^}]+)}/g;
    return template.replace(regex, (_, path) => {
        const value = resolveKey(context, path.trim());
        return value !== undefined ? value : '';
    });
};

export const resolveKey = (object, path) => {
    try {
        return path.split('.').reduce((acc, part) => acc && acc[part], object);
    } catch (e) {
        return undefined;
    }
};


export function resolveParameterValue(item, context, container, state, init = false) {
    const location = item.location || ''
    const index = location.indexOf(".")
    let fieldName = ""
    let source = location
    if (index !== -1) {
        fieldName = location.substring(index + 1, location.length);
        source = location.substring(0, index);
    }
    let resolved = null
    switch (item.in) {
        case 'dataSource':
            let dsContext = context
            if (source) {
                dsContext = context.Context(source)
            }
            if (init) {
                resolved = dsContext.handlers.dataSource.peekDataSourceValue(item.scope);
            } else {
                resolved = dsContext.handlers.dataSource.getDataSourceValue(item.scope);
            }
            return resolveSelector(resolved, fieldName)
        case 'state':
            [resolved]  = state
            return resolveSelector(resolved, fieldName)
        default:
            throw new Error(`Unsupported parameter: ${item.name} - in was missing`);
    }
}


/**
 * Resolve dot separated selector
 */
export const resolveSelector = (holder, selector) => {
    // Return early if no selector or holder itself is null/undefined
    if (!selector || holder == null) {
        return holder;
    }

    const keys = selector.split('.')

    let current = holder;
    for (const key of keys) {
        if (current == null) {
            return undefined; // path breaks – stay safe
        }
        current = current[key];
    }
    return current;
};


/**
 * Clone an object and set the value at a dotted path.
 * This helper keeps immutability guarantees expected by the store hooks.
 * @param {Object} holder base object to clone from (may be undefined)
 * @param {String} path dot separated property path, e.g. "options.provider"
 * @param {*} value value to set
 * @returns {Object} new cloned object with the desired value set
 */
export const setSelector = (holder, path, value) => {
    if (!path || typeof path !== 'string' || path.indexOf('.') === -1) {
        return {
            ...(holder || {}),
            [path]: value,
        };
    }

    const keys = path.split('.');
    const [head, ...tail] = keys;
    const existing = holder && typeof holder === 'object' ? holder[head] : undefined;

    return {
        ...(holder || {}),
        [head]: setSelector(existing || {}, tail.join('.'), value),
    };
};
