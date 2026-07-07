// Scope bindings connect reportDocument scope params to report builder block
// state. Predicate-backed configs bind through the scope-native
// "scopeParams.<id>" target; legacy static-filter configs keep the historical
// "staticFilters.<id>" target. Both conventions resolve to the same builder
// state slot (the pinned scope-param values map accessed via scopeStateModel,
// canonically state.scopeParams[<id>]) while the builder state shape stays
// keyed by filter id.

export const SCOPE_PARAMS_BINDING_PREFIX = "scopeParams.";
export const STATIC_FILTERS_BINDING_PREFIX = "staticFilters.";

const SUPPORTED_SCOPE_BINDING_PREFIXES = [
  SCOPE_PARAMS_BINDING_PREFIX,
  STATIC_FILTERS_BINDING_PREFIX,
];

export function resolveScopeBindingFilterId(target = "") {
  const normalizedTarget = String(target || "").trim();
  const prefix = SUPPORTED_SCOPE_BINDING_PREFIXES.find((entry) => normalizedTarget.startsWith(entry));
  return prefix ? normalizedTarget.slice(prefix.length).trim() : "";
}

export function isSupportedScopeBindingTarget(target = "") {
  return !!resolveScopeBindingFilterId(target);
}
