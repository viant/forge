function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizePreviewDetailTargetBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const targetRef = normalizeString(match.targetRef || behavior.targetRef);
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  const result = Object.prototype.hasOwnProperty.call(behavior, "result")
    ? cloneValue(behavior.result)
    : undefined;
  if (!targetRef) {
    return null;
  }
  return {
    match: {
      targetRef,
    },
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(result !== undefined ? { result } : {}),
  };
}

function ensureDetailTargetBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.detailTargetBehaviors)
    ? metrics.detailTargetBehaviors
    : [];
  metrics.detailTargetBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewDetailTargetBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.detailTargetBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewDetailTargetBehavior(behavior))
    .filter(Boolean);
  return metrics.detailTargetBehaviors.length;
}

export function clearPreviewDetailTargetBehaviors(metrics = {}) {
  metrics.detailTargetBehaviors = [];
  return 0;
}

function matchesDetailTargetBehavior(behavior = {}, { targetRef = "" } = {}) {
  const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
  if (normalizeString(match.targetRef) && normalizeString(match.targetRef) !== normalizeString(targetRef)) {
    return false;
  }
  return true;
}

export function consumePreviewDetailTargetBehavior(metrics = {}, query = {}) {
  const behaviors = ensureDetailTargetBehaviors(metrics);
  const index = behaviors.findIndex((behavior) => matchesDetailTargetBehavior(behavior, query));
  if (index === -1) {
    return undefined;
  }
  const [behavior] = behaviors.splice(index, 1);
  return behavior;
}

export async function applyPreviewDetailTargetBehavior(metrics = {}, query = {}) {
  const behavior = consumePreviewDetailTargetBehavior(metrics, query);
  if (!behavior) {
    return undefined;
  }
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  if (Object.prototype.hasOwnProperty.call(behavior, "result")) {
    return cloneValue(behavior.result);
  }
  return undefined;
}

export function attachPreviewDetailTargetBehaviorApi(metrics = {}) {
  metrics.replaceDetailTargetBehaviors = function replaceDetailTargetBehaviors(nextBehaviors = []) {
    return replacePreviewDetailTargetBehaviors(metrics, nextBehaviors);
  };
  metrics.clearDetailTargetBehaviors = function clearDetailTargetBehaviors() {
    return clearPreviewDetailTargetBehaviors(metrics);
  };
  return metrics;
}
