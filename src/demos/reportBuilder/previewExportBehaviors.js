function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizePreviewExportBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const phase = normalizeString(match.phase || behavior.phase).toLowerCase();
  const source = normalizeString(match.source || behavior.source);
  const format = normalizeString(match.format || behavior.format).toLowerCase();
  const artifactRef = normalizeString(match.artifactRef || behavior.artifactRef);
  const title = normalizeString(match.title || behavior.title);
  const jobId = normalizeString(match.jobId || behavior.jobId);
  const artifactId = normalizeString(match.artifactId || behavior.artifactId);
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = normalizeString(behavior.error?.message || behavior.errorMessage || behavior.error);
  const result = behavior.result && typeof behavior.result === "object" && !Array.isArray(behavior.result)
    ? cloneValue(behavior.result)
    : null;
  if (!phase && !source && !format && !artifactRef && !title && !jobId && !artifactId) {
    return null;
  }
  return {
    match: {
      ...(phase ? { phase } : {}),
      ...(source ? { source } : {}),
      ...(format ? { format } : {}),
      ...(artifactRef ? { artifactRef } : {}),
      ...(title ? { title } : {}),
      ...(jobId ? { jobId } : {}),
      ...(artifactId ? { artifactId } : {}),
    },
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(result ? { result } : {}),
  };
}

function ensureExportBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.exportBehaviors)
    ? metrics.exportBehaviors
    : [];
  metrics.exportBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewExportBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.exportBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewExportBehavior(behavior))
    .filter(Boolean);
  return metrics.exportBehaviors.length;
}

export function clearPreviewExportBehaviors(metrics = {}) {
  metrics.exportBehaviors = [];
  return 0;
}

function matchesExportBehavior(behavior = {}, {
  phase = "",
  source = "",
  format = "",
  artifactRef = "",
  title = "",
  jobId = "",
  artifactId = "",
} = {}) {
  const match = behavior?.match && typeof behavior.match === "object" ? behavior.match : {};
  if (normalizeString(match.phase) && normalizeString(match.phase) !== normalizeString(phase).toLowerCase()) {
    return false;
  }
  if (normalizeString(match.source) && normalizeString(match.source) !== normalizeString(source)) {
    return false;
  }
  if (normalizeString(match.format) && normalizeString(match.format) !== normalizeString(format).toLowerCase()) {
    return false;
  }
  if (normalizeString(match.artifactRef) && normalizeString(match.artifactRef) !== normalizeString(artifactRef)) {
    return false;
  }
  if (normalizeString(match.title) && normalizeString(match.title) !== normalizeString(title)) {
    return false;
  }
  if (normalizeString(match.jobId) && normalizeString(match.jobId) !== normalizeString(jobId)) {
    return false;
  }
  if (normalizeString(match.artifactId) && normalizeString(match.artifactId) !== normalizeString(artifactId)) {
    return false;
  }
  return true;
}

export function consumePreviewExportBehavior(metrics = {}, query = {}) {
  const behaviors = ensureExportBehaviors(metrics);
  const index = behaviors.findIndex((behavior) => matchesExportBehavior(behavior, query));
  if (index === -1) {
    return null;
  }
  const [behavior] = behaviors.splice(index, 1);
  return behavior || null;
}

export async function applyPreviewExportBehavior(metrics = {}, query = {}) {
  const behavior = consumePreviewExportBehavior(metrics, query);
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

export function attachPreviewExportBehaviorApi(metrics = {}) {
  metrics.replaceExportBehaviors = function replaceExportBehaviors(nextBehaviors = []) {
    return replacePreviewExportBehaviors(metrics, nextBehaviors);
  };
  metrics.clearExportBehaviors = function clearExportBehaviors() {
    return clearPreviewExportBehaviors(metrics);
  };
  return metrics;
}
