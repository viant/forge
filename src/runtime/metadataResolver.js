function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => cloneValue(item));
    }
    if (isPlainObject(value)) {
        const result = {};
        for (const [key, item] of Object.entries(value)) {
            result[key] = cloneValue(item);
        }
        return result;
    }
    return value;
}

function normalizeTargetSpec(spec) {
    if (!spec) return null;
    if (typeof spec === 'string') {
        return {
            platforms: [spec],
            excludePlatforms: [],
            formFactors: [],
            capabilities: []
        };
    }
    if (Array.isArray(spec)) {
        return {
            platforms: spec.filter((item) => typeof item === 'string'),
            excludePlatforms: [],
            formFactors: [],
            capabilities: []
        };
    }
    if (!isPlainObject(spec)) return null;
    return {
        platforms: Array.isArray(spec.platforms) ? spec.platforms.filter((item) => typeof item === 'string') : [],
        excludePlatforms: Array.isArray(spec.excludePlatforms) ? spec.excludePlatforms.filter((item) => typeof item === 'string') : [],
        formFactors: Array.isArray(spec.formFactors) ? spec.formFactors.filter((item) => typeof item === 'string') : [],
        capabilities: Array.isArray(spec.capabilities) ? spec.capabilities.filter((item) => typeof item === 'string') : []
    };
}

function matchesTarget(spec, targetContext = {}) {
    const normalized = normalizeTargetSpec(spec);
    if (!normalized) return true;

    const platform = String(targetContext.platform || '').trim();
    const formFactor = String(targetContext.formFactor || '').trim();
    const capabilities = new Set(
        Array.isArray(targetContext.capabilities)
            ? targetContext.capabilities.map((item) => String(item || '').trim()).filter(Boolean)
            : []
    );

    if (normalized.platforms.length > 0) {
        if (!platform || !normalized.platforms.includes(platform)) {
            return false;
        }
    }
    if (normalized.excludePlatforms.length > 0 && platform && normalized.excludePlatforms.includes(platform)) {
        return false;
    }
    if (normalized.formFactors.length > 0) {
        if (!formFactor || !normalized.formFactors.includes(formFactor)) {
            return false;
        }
    }
    if (normalized.capabilities.length > 0) {
        for (const capability of normalized.capabilities) {
            if (!capabilities.has(capability)) {
                return false;
            }
        }
    }
    return true;
}

function deepMerge(base, override) {
    if (Array.isArray(override)) {
        return override.map((item) => cloneValue(item));
    }
    if (!isPlainObject(override)) {
        return cloneValue(override);
    }
    const result = isPlainObject(base) ? cloneValue(base) : {};
    for (const [key, value] of Object.entries(override)) {
        const current = result[key];
        if (isPlainObject(current) && isPlainObject(value)) {
            result[key] = deepMerge(current, value);
            continue;
        }
        result[key] = deepMerge(undefined, value);
    }
    return result;
}

function applicableOverrides(targetOverrides, targetContext = {}) {
    if (!isPlainObject(targetOverrides)) return [];
    const platform = String(targetContext.platform || '').trim();
    const formFactor = String(targetContext.formFactor || '').trim();
    const keys = [];
    if (platform) {
        keys.push(platform);
        if (formFactor) {
            keys.push(`${platform}:${formFactor}`);
            keys.push(`${platform}.${formFactor}`);
        }
    }
    if (formFactor) {
        keys.push(`formFactor:${formFactor}`);
        keys.push(formFactor);
    }
    const seen = new Set();
    const result = [];
    for (const key of keys) {
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const candidate = targetOverrides[key];
        if (isPlainObject(candidate)) {
            result.push(candidate);
        }
    }
    return result;
}

function resolveValue(node, targetContext = {}) {
    if (Array.isArray(node)) {
        const result = [];
        for (const item of node) {
            const resolved = resolveValue(item, targetContext);
            if (typeof resolved !== 'undefined') {
                result.push(resolved);
            }
        }
        return result;
    }
    if (!isPlainObject(node)) {
        return node;
    }

    if (!matchesTarget(node.target, targetContext)) {
        return undefined;
    }

    let working = cloneValue(node);
    const overrides = applicableOverrides(working.targetOverrides, targetContext);
    for (const override of overrides) {
        working = deepMerge(working, override);
    }

    delete working.target;
    delete working.targetOverrides;

    const result = {};
    for (const [key, value] of Object.entries(working)) {
        const resolved = resolveValue(value, targetContext);
        if (typeof resolved !== 'undefined') {
            result[key] = resolved;
        }
    }
    return result;
}

export function resolveMetadataForTarget(metadata, targetContext = {}) {
    if (!metadata || typeof metadata !== 'object') {
        return metadata;
    }
    return resolveValue(metadata, targetContext);
}

export function __private__() {
    return {
        normalizeTargetSpec,
        matchesTarget,
        deepMerge,
        applicableOverrides,
        resolveValue
    };
}
