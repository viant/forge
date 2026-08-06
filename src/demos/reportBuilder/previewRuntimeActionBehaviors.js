import { normalizeRefinementActions } from "../../reporting/drillMetadataProvider.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizePreviewRuntimeActionBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const normalizedMatch = {
    ...(normalizeString(match.blockKind) ? { blockKind: normalizeString(match.blockKind) } : {}),
    ...(normalizeString(match.fieldRef || match.field || match.valueKey) ? { fieldRef: normalizeString(match.fieldRef || match.field || match.valueKey) } : {}),
  };
  const actions = normalizeRefinementActions(behavior.actions || []);
  if (actions.length === 0) {
    return null;
  }
  return {
    ...(Object.keys(normalizedMatch).length > 0 ? { match: normalizedMatch } : {}),
    actions,
  };
}

function ensureRuntimeActionBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.runtimeActionBehaviors)
    ? metrics.runtimeActionBehaviors
    : [];
  metrics.runtimeActionBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewRuntimeActionBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.runtimeActionBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewRuntimeActionBehavior(behavior))
    .filter(Boolean);
  return metrics.runtimeActionBehaviors.length;
}

export function clearPreviewRuntimeActionBehaviors(metrics = {}) {
  metrics.runtimeActionBehaviors = [];
  return 0;
}

export function resolvePreviewRuntimeActions(metrics = {}, blockKind = "", fieldRef = "", fallbackActions = []) {
  const behaviors = ensureRuntimeActionBehaviors(metrics);
  const normalizedBlockKind = normalizeString(blockKind);
  const normalizedFieldRef = normalizeString(fieldRef);
  const override = behaviors.find((behavior) => {
    const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
    if (normalizeString(match.blockKind) && normalizeString(match.blockKind) !== normalizedBlockKind) {
      return false;
    }
    if (normalizeString(match.fieldRef) && normalizeString(match.fieldRef) !== normalizedFieldRef) {
      return false;
    }
    return true;
  });
  return override ? override.actions : (Array.isArray(fallbackActions) ? fallbackActions : []);
}

export function attachPreviewRuntimeActionBehaviorApi(metrics = {}) {
  metrics.replaceRuntimeActionBehaviors = function replaceRuntimeActionBehaviors(nextBehaviors = []) {
    return replacePreviewRuntimeActionBehaviors(metrics, nextBehaviors);
  };
  metrics.clearRuntimeActionBehaviors = function clearRuntimeActionBehaviors() {
    return clearPreviewRuntimeActionBehaviors(metrics);
  };
  return metrics;
}
