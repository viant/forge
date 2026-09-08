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

function resolvedPathValue(target, path) {
    const parts = String(path || '').split('.').filter(Boolean);
    if (parts.length === 0) return undefined;
    let current = target;
    for (const part of parts) {
        if (current == null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
        current = current[part];
    }
    return current;
}

function isMeaningfulDependencyValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.some((entry) => isMeaningfulDependencyValue(entry));
    return true;
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

export function hasResolvedDependencies(parameters = [], values = {}, filter = {}, requiredAnyParameters = []) {
    if (!parameters || parameters.length === 0) return true;

    for (const paramDef of parameters) {
        if (paramDef?.from === 'const') {
            assignPath(filter, paramDef.name, paramDef.location);
            continue;
        }
        if (hasDefinedPath(values, paramDef.name) && isMeaningfulDependencyValue(resolvedPathValue(values, paramDef.name))) continue;
        if ('default' in paramDef) {
            assignPath(values, paramDef.name, paramDef.default);
            continue;
        }
        if (paramDef.required === false) continue;
        return false;
    }
    const requiredAny = Array.isArray(requiredAnyParameters)
        ? requiredAnyParameters.map((name) => String(name || '').trim()).filter(Boolean)
        : [];
    if (requiredAny.length > 0 && !requiredAny.some((name) => isMeaningfulDependencyValue(resolvedPathValue(values, name)))) {
        return false;
    }
    return true;
}
