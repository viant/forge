// Portable navigation bindings read only explicitly named inputs. They do not
// infer entity IDs from a selection or coerce their types.
export function resolveNavigationParameters(action = {}, current = {}) {
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    let parameters = object(action.parameters) ? structuredClone(action.parameters) : {};
    if (action.parameterBindings == null) return {parameters, missing: false};
    if (!object(action.parameterBindings)) return {parameters, missing: true};
    for (const [name, binding] of Object.entries(action.parameterBindings)) {
        if (!object(binding)) return {parameters, missing: true};
        const names = typeof binding.from === 'string' ? [binding.from] : binding.from;
        if (!Array.isArray(names) || !names.length || names.length > 8 || names.some(key => typeof key !== 'string' || !key)) {
            return {parameters, missing: true};
        }
        const field = names.find(key => Object.hasOwn(current, key) && current[key] !== undefined && current[key] !== null);
        if (field === undefined) {
            if (binding.optional === true) continue;
            return {parameters, missing: true};
        }
        let value = structuredClone(current[field]);
        if (binding.array === true && !Array.isArray(value)) value = [value];
        Object.defineProperty(parameters, name, {value, enumerable: true, writable: true, configurable: true});
    }
    return {parameters, missing: false};
}
