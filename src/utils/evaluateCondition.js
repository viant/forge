const isEmptyValue = (value) => {
    if (value == null) return true;
    if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

const containsValue = (actual, expected) => {
    if (Array.isArray(actual)) return actual.includes(expected);
    if (typeof actual === 'string') return actual.includes(String(expected));
    if (actual && typeof actual === 'object') return Object.hasOwn(actual, expected);
    return false;
};

const numericBounds = [
    ['gt', (value, bound) => value > bound],
    ['gte', (value, bound) => value >= bound],
    ['lt', (value, bound) => value < bound],
    ['lte', (value, bound) => value <= bound],
];

// The caller resolves each leaf against its own scope. Resource validation can
// supply a second field from the same canonical record as a numeric bound.
export function evaluateCondition(rule, read, readBound) {
    if (!rule) return true;
    if (Array.isArray(rule.all)) return rule.all.every(child => evaluateCondition(child, read, readBound));
    if (Array.isArray(rule.any)) return rule.any.some(child => evaluateCondition(child, read, readBound));
    if (rule.not) return !evaluateCondition(rule.not, read, readBound);
    const actual = read(rule);
    if (rule.equals !== undefined) {
        return actual === rule.equals;
    }
    if (Array.isArray(rule.in)) {
        return rule.in.includes(actual);
    }
    let compared = false, value;
    for (const [key, compare] of numericBounds) {
        let bound = rule[key];
        const peer = rule[key + 'Field'];
        if (readBound && peer !== undefined) bound = readBound(peer);
        else if (bound === undefined) continue;
        if (!compared) {
            value = Number(actual);
            if (!Number.isFinite(value)) return false;
            compared = true;
        }
        const limit = Number(bound);
        if (!Number.isFinite(limit) || !compare(value, limit)) return false;
    }
    if (compared) return true;
    if (rule.notEquals !== undefined) {
        return actual !== rule.notEquals;
    }
    if (rule.contains !== undefined) {
        return containsValue(actual, rule.contains);
    }
    if (rule.matches !== undefined) {
        try {
            return new RegExp(String(rule.matches)).test(String(actual ?? ''));
        } catch (_) {
            return false;
        }
    }
    if (rule.empty !== undefined) {
        return isEmptyValue(actual) === rule.empty;
    }
    if (rule.notEmpty !== undefined) {
        return (!isEmptyValue(actual)) === rule.notEmpty;
    }
    if (rule.exists !== undefined) {
        return (actual !== undefined && actual !== null) === rule.exists;
    }
    if (String(rule.source || '').toLowerCase() === 'authorization') {
        return false;
    }
    return !!actual;
}
