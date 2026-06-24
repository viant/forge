function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizePreviewLifecycleBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const action = normalizeString(match.action || behavior.action).toLowerCase();
  const source = normalizeString(match.source || behavior.source);
  const reportId = normalizeString(match.reportId || behavior.reportId);
  const artifactRef = normalizeString(match.artifactRef || behavior.artifactRef);
  const title = normalizeString(match.title || behavior.title);
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  const result = behavior.result && typeof behavior.result === "object" && !Array.isArray(behavior.result)
    ? cloneValue(behavior.result)
    : null;
  if (!action && !source && !reportId && !artifactRef && !title) {
    return null;
  }
  return {
    match: {
      ...(action ? { action } : {}),
      ...(source ? { source } : {}),
      ...(reportId ? { reportId } : {}),
      ...(artifactRef ? { artifactRef } : {}),
      ...(title ? { title } : {}),
    },
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(result ? { result } : {}),
  };
}

function ensureLifecycleBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.lifecycleBehaviors)
    ? metrics.lifecycleBehaviors
    : [];
  metrics.lifecycleBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewLifecycleBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.lifecycleBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewLifecycleBehavior(behavior))
    .filter(Boolean);
  return metrics.lifecycleBehaviors.length;
}

export function clearPreviewLifecycleBehaviors(metrics = {}) {
  metrics.lifecycleBehaviors = [];
  return 0;
}

function matchesLifecycleBehavior(behavior = {}, {
  action = "",
  source = "",
  reportId = "",
  artifactRef = "",
  title = "",
} = {}) {
  const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
  if (normalizeString(match.action) && normalizeString(match.action) !== normalizeString(action).toLowerCase()) {
    return false;
  }
  if (normalizeString(match.source) && normalizeString(match.source) !== normalizeString(source)) {
    return false;
  }
  if (normalizeString(match.reportId) && normalizeString(match.reportId) !== normalizeString(reportId)) {
    return false;
  }
  if (normalizeString(match.artifactRef) && normalizeString(match.artifactRef) !== normalizeString(artifactRef)) {
    return false;
  }
  if (normalizeString(match.title) && normalizeString(match.title) !== normalizeString(title)) {
    return false;
  }
  return true;
}

export function consumePreviewLifecycleBehavior(metrics = {}, query = {}) {
  const behaviors = ensureLifecycleBehaviors(metrics);
  const index = behaviors.findIndex((behavior) => matchesLifecycleBehavior(behavior, query));
  if (index === -1) {
    return null;
  }
  const [behavior] = behaviors.splice(index, 1);
  return behavior || null;
}

export async function applyPreviewLifecycleBehavior(metrics = {}, query = {}) {
  const behavior = consumePreviewLifecycleBehavior(metrics, query);
  if (!behavior) {
    return null;
  }
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  if (errorMessage) {
    const error = new Error(errorMessage);
    if (behavior.result && typeof behavior.result === "object" && !Array.isArray(behavior.result)) {
      error.toolResult = cloneValue(behavior.result);
    }
    throw error;
  }
  return behavior.result ? cloneValue(behavior.result) : null;
}

export function attachPreviewLifecycleBehaviorApi(metrics = {}) {
  metrics.replaceLifecycleBehaviors = function replaceLifecycleBehaviors(nextBehaviors = []) {
    return replacePreviewLifecycleBehaviors(metrics, nextBehaviors);
  };
  metrics.clearLifecycleBehaviors = function clearLifecycleBehaviors() {
    return clearPreviewLifecycleBehaviors(metrics);
  };
  return metrics;
}
