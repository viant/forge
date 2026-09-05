function hasDefinedPath(target, path) {
    const parts = String(path || '').split('.').filter(Boolean);
    if (parts.length === 0) return false;
    let current = target;
    for (const part of parts) {
        if (current == null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return false;
        current = current[part];
    }
    return current !== undefined;
}

function assignPath(target, path, value) {
    const parts = String(path || '').split('.').filter(Boolean);
    if (parts.length === 0 || !target || typeof target !== 'object') return;
    let current = target;
    for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        if (!current[part] || typeof current[part] !== 'object') current[part] = {};
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}

export function hasResolvedDependencies(parameters = [], values = {}, filter = {}) {
    if (!parameters || parameters.length === 0) return true;

    for (const paramDef of parameters) {
        if (paramDef?.from === 'const') {
            assignPath(filter, paramDef.name, paramDef.location);
            continue;
        }
        if (hasDefinedPath(values, paramDef.name)) continue;
        if ('default' in paramDef) {
            assignPath(values, paramDef.name, paramDef.default);
            continue;
        }
        if (paramDef.required === false) continue;
        return false;
    }
    return true;
}
