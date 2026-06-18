import { normalizeRefinementActions } from "../../reporting/drillMetadataProvider.js";

function normalizeString(value = "") {
  return String(value || "").trim();
}

function clonePreviewValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizePreviewRuntimeActionBehaviorError(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return "";
  }
  const explicitErrorMessage = normalizeString(behavior.errorMessage);
  if (explicitErrorMessage) {
    return explicitErrorMessage;
  }
  if (behavior.error && typeof behavior.error === "object" && !Array.isArray(behavior.error)) {
    return normalizeString(behavior.error.message);
  }
  return normalizeString(behavior.error);
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
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = normalizePreviewRuntimeActionBehaviorError(behavior);
  const actions = normalizeRefinementActions(behavior.actions || []);
  if (actions.length === 0 && !errorMessage) {
    return null;
  }
  return {
    ...(Object.keys(normalizedMatch).length > 0 ? { match: normalizedMatch } : {}),
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(actions.length > 0 ? { actions } : {}),
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

function findPreviewRuntimeActionBehavior(metrics = {}, blockKind = "", fieldRef = "") {
  const behaviors = ensureRuntimeActionBehaviors(metrics);
  const normalizedBlockKind = normalizeString(blockKind);
  const normalizedFieldRef = normalizeString(fieldRef);
  return behaviors.find((behavior) => {
    const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
    if (normalizeString(match.blockKind) && normalizeString(match.blockKind) !== normalizedBlockKind) {
      return false;
    }
    if (normalizeString(match.fieldRef) && normalizeString(match.fieldRef) !== normalizedFieldRef) {
      return false;
    }
    return true;
  });
}

export function resolvePreviewRuntimeActions(metrics = {}, blockKind = "", fieldRef = "", fallbackActions = []) {
  const override = findPreviewRuntimeActionBehavior(metrics, blockKind, fieldRef);
  const errorMessage = normalizeString(override?.error);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return Array.isArray(override?.actions)
    ? clonePreviewValue(override.actions)
    : clonePreviewValue(Array.isArray(fallbackActions) ? fallbackActions : []);
}

export async function applyPreviewRuntimeActionBehavior(metrics = {}, blockKind = "", fieldRef = "", fallbackActions = []) {
  const override = findPreviewRuntimeActionBehavior(metrics, blockKind, fieldRef);
  if (!override) {
    return clonePreviewValue(Array.isArray(fallbackActions) ? fallbackActions : []);
  }
  const delayMs = Math.max(0, Number(override.delayMs || 0) || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const errorMessage = normalizeString(override.error);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return Array.isArray(override.actions)
    ? clonePreviewValue(override.actions)
    : clonePreviewValue(Array.isArray(fallbackActions) ? fallbackActions : []);
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
