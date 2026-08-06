function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizePreviewFetchBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const requestFingerprint = normalizeString(match.requestFingerprint);
  const requestKey = normalizeString(match.requestKey);
  const type = normalizeString(match.type || behavior.type).toLowerCase();
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  const result = behavior.result && typeof behavior.result === "object" && !Array.isArray(behavior.result)
    ? cloneValue(behavior.result)
    : null;
  if (!requestFingerprint && !requestKey && !type) {
    return null;
  }
  return {
    match: {
      ...(type ? { type } : {}),
      ...(requestFingerprint ? { requestFingerprint } : {}),
      ...(requestKey ? { requestKey } : {}),
    },
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(result ? { result } : {}),
  };
}

function ensureFetchBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.fetchBehaviors)
    ? metrics.fetchBehaviors
    : [];
  metrics.fetchBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewFetchBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.fetchBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewFetchBehavior(behavior))
    .filter(Boolean);
  return metrics.fetchBehaviors.length;
}

export function clearPreviewFetchBehaviors(metrics = {}) {
  metrics.fetchBehaviors = [];
  return 0;
}

function matchesFetchBehavior(behavior = {}, {
  type = "",
  requestFingerprint = "",
  requestKey = "",
} = {}) {
  const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
  if (normalizeString(match.type) && normalizeString(match.type) !== normalizeString(type).toLowerCase()) {
    return false;
  }
  if (normalizeString(match.requestFingerprint) && normalizeString(match.requestFingerprint) !== normalizeString(requestFingerprint)) {
    return false;
  }
  if (normalizeString(match.requestKey) && normalizeString(match.requestKey) !== normalizeString(requestKey)) {
    return false;
  }
  return true;
}

export function consumePreviewFetchBehavior(metrics = {}, query = {}) {
  const behaviors = ensureFetchBehaviors(metrics);
  const index = behaviors.findIndex((behavior) => matchesFetchBehavior(behavior, query));
  if (index === -1) {
    return null;
  }
  const [behavior] = behaviors.splice(index, 1);
  return behavior || null;
}

export async function applyPreviewFetchBehavior(metrics = {}, query = {}) {
  const behavior = consumePreviewFetchBehavior(metrics, query);
  if (!behavior) {
    return null;
  }
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return behavior.result ? cloneValue(behavior.result) : null;
}

export function attachPreviewFetchBehaviorApi(metrics = {}) {
  metrics.replaceFetchBehaviors = function replaceFetchBehaviors(nextBehaviors = []) {
    return replacePreviewFetchBehaviors(metrics, nextBehaviors);
  };
  metrics.clearFetchBehaviors = function clearFetchBehaviors() {
    return clearPreviewFetchBehaviors(metrics);
  };
  return metrics;
}
