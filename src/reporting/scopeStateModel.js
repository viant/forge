// Pinned scope params (predicate-native pinned filters) keep their live
// runtime values in report builder block state. This model is the single
// access path runtime/UI/request code uses to read and write those values,
// so callers no longer assume the underlying state shape.
//
// Canonical storage is the scope-native `scopeParams` state key (matching the
// "scopeParams.<id>" scope-binding target convention). Older saved builder
// state stored the values under the legacy `staticFilters` key; reads fall
// back to it when the canonical key is absent, and any write migrates the
// values forward so newly written state carries only `scopeParams`.

const SCOPE_PARAM_STATE_KEY = "scopeParams";
const LEGACY_SCOPE_PARAM_STATE_KEY = "staticFilters";

const EMPTY_SCOPE_PARAM_VALUES = Object.freeze({});

function asScopeParamValuesMap(candidate) {
    return !!candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : null;
}

// Resolves the scope-param id for a pinned param definition (a lowered
// predicate or legacy static-filter entry): explicit id first, field fallback.
export function resolveScopeParamId(paramDef) {
    return String(paramDef?.id || paramDef?.field || "").trim();
}

// True when the state carries a pinned scope-param values map (canonical or
// legacy key), as opposed to the slice being absent or malformed.
export function hasScopeParamValues(state) {
    return !!(
        asScopeParamValuesMap(state?.[SCOPE_PARAM_STATE_KEY])
        || asScopeParamValuesMap(state?.[LEGACY_SCOPE_PARAM_STATE_KEY])
    );
}

// Returns the map of pinned scope-param values keyed by param id. The result
// is identity-stable: the underlying state slice when present (canonical key
// first, legacy fallback), a shared frozen empty object otherwise. Treat it
// as read-only.
export function listScopeParamValues(state) {
    return asScopeParamValuesMap(state?.[SCOPE_PARAM_STATE_KEY])
        || asScopeParamValuesMap(state?.[LEGACY_SCOPE_PARAM_STATE_KEY])
        || EMPTY_SCOPE_PARAM_VALUES;
}

export function getScopeParamValue(state, paramId) {
    const id = String(paramId || "").trim();
    return id ? listScopeParamValues(state)[id] : undefined;
}

// Returns a new state object with the pinned scope-param value replaced;
// the input state is not mutated.
export function setScopeParamValue(state, paramId, value) {
    const id = String(paramId || "").trim();
    if (!id) {
        return state;
    }
    return mergeScopeParamValues(state, { [id]: value });
}

// Returns a new state object with the given pinned scope-param values merged
// over the existing ones. The values slice is (re)created even when no new
// values are provided, so callers hydrating scope bindings always end up with
// a well-formed slice. Writing migrates legacy-keyed values onto the
// canonical key and drops the legacy key. The input state is not mutated.
export function mergeScopeParamValues(state, values) {
    const { [LEGACY_SCOPE_PARAM_STATE_KEY]: _legacyValues, ...nextState } = state || {};
    return {
        ...nextState,
        [SCOPE_PARAM_STATE_KEY]: {
            ...listScopeParamValues(state),
            ...(values || {}),
        },
    };
}

// Builds the state slice holding pinned scope-param values, for spreading
// into a builder-state literal without naming the storage key.
export function scopeParamStateSlice(values) {
    return {
        [SCOPE_PARAM_STATE_KEY]: { ...(values || {}) },
    };
}

// Dot-path of a pinned scope-param value inside builder state, for
// diagnostics that point at state locations.
export function scopeParamStatePath(paramId) {
    const id = String(paramId || "").trim();
    return id ? `${SCOPE_PARAM_STATE_KEY}.${id}` : SCOPE_PARAM_STATE_KEY;
}
