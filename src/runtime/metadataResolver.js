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
        const platform = spec.trim();
        if (!platform) return null;
        return {
            platforms: [platform],
            excludePlatforms: [],
            formFactors: [],
            capabilities: []
        };
    }
    if (Array.isArray(spec)) {
        const normalized = {
            platforms: spec.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean),
            excludePlatforms: [],
            formFactors: [],
            capabilities: []
        };
        return hasTargetCriteria(normalized) ? normalized : null;
    }
    if (!isPlainObject(spec)) return null;
    const normalized = {
        platforms: trimmedStringList(spec.platforms),
        excludePlatforms: trimmedStringList(spec.excludePlatforms),
        formFactors: trimmedStringList(spec.formFactors),
        capabilities: trimmedStringList(spec.capabilities)
    };
    return hasTargetCriteria(normalized) ? normalized : null;
}

function trimmedStringList(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean);
}

function hasTargetCriteria(normalized) {
    return normalized.platforms.length > 0 ||
        normalized.excludePlatforms.length > 0 ||
        normalized.formFactors.length > 0 ||
        normalized.capabilities.length > 0;
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
    const keys = targetOverrideKeys(targetContext);
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

function targetOverrideKeys(targetContext = {}) {
    const platform = String(targetContext.platform || '').trim();
    const formFactor = String(targetContext.formFactor || '').trim();
    const surface = String(targetContext.surface || '').trim();
    const mobilePlatforms = new Set(['android', 'ios']);
    const mobileFormFactors = new Set(['phone', 'tablet', 'foldable']);
    const isMobile = mobilePlatforms.has(platform) || mobileFormFactors.has(formFactor);
    const keys = [];

    if (surface) {
        keys.push(`surface:${surface}`);
        keys.push(surface);
    }
    if (isMobile) {
        keys.push('mobile');
    }
    if (formFactor) {
        keys.push(`formFactor:${formFactor}`);
        keys.push(formFactor);
    }
    if (platform) {
        keys.push(platform);
    }
    if (isMobile && formFactor) {
        keys.push(`mobile.${formFactor}`);
        keys.push(`mobile:${formFactor}`);
        keys.push(`mobile/${formFactor}`);
    }
    if (platform && formFactor) {
        keys.push(`${platform}.${formFactor}`);
        keys.push(`${platform}/${formFactor}`);
        keys.push(`${platform}:${formFactor}`);
        keys.push(platformFormFactorAlias(platform, formFactor));
    }
    return keys;
}

function platformFormFactorAlias(platform, formFactor) {
    return `${platform}${formFactor.charAt(0).toUpperCase()}${formFactor.slice(1)}`;
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

    if (normalizeTargetSpec(working.target)) {
        delete working.target;
    }
    if (
        isPlainObject(working.targetOverrides) &&
        Object.keys(working.targetOverrides).length > 0 &&
        Object.values(working.targetOverrides).every((value) => isPlainObject(value))
    ) {
        delete working.targetOverrides;
    }

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
        targetOverrideKeys,
        resolveValue
    };
}
