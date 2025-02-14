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
    if (!selector) {
        return holder;
    }
    const keys = selector.split(".");
    if (keys.length === 1) {
        return holder[selector]
    }
    let result = holder;
    for (const key of keys) {
        result = result[key]
    }
    return result;
};
