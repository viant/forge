function clonePreviewValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export const PREVIEW_SEMANTIC_MODEL_STORAGE_KEY = "forge.reportBuilderPreview.semanticModelBehaviors";

export function normalizePreviewSemanticModelBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return null;
  }
  const match = behavior.match && typeof behavior.match === "object" && !Array.isArray(behavior.match)
    ? behavior.match
    : {};
  const normalizedMatch = {
    ...(String(match.modelRef || "").trim() ? { modelRef: String(match.modelRef).trim() } : {}),
  };
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = String(behavior.error?.message || behavior.errorMessage || behavior.error || "").trim();
  const result = behavior.result && typeof behavior.result === "object" && !Array.isArray(behavior.result)
    ? clonePreviewValue(behavior.result)
    : null;
  return {
    ...(Object.keys(normalizedMatch).length > 0 ? { match: normalizedMatch } : {}),
    ...(delayMs > 0 ? { delayMs } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
    ...(result ? { result } : {}),
  };
}

function ensureMetricsBehaviors(metrics = {}) {
  const currentBehaviors = Array.isArray(metrics.semanticModelBehaviors)
    ? metrics.semanticModelBehaviors
    : [];
  metrics.semanticModelBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewSemanticModelBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.semanticModelBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewSemanticModelBehavior(behavior))
    .filter(Boolean);
  return metrics.semanticModelBehaviors.length;
}

export function queuePreviewSemanticModelBehavior(metrics = {}, nextBehavior = {}) {
  const behavior = normalizePreviewSemanticModelBehavior(nextBehavior);
  const currentBehaviors = ensureMetricsBehaviors(metrics);
  if (!behavior) {
    return currentBehaviors.length;
  }
  metrics.semanticModelBehaviors = [...currentBehaviors, behavior];
  return metrics.semanticModelBehaviors.length;
}

export function clearPreviewSemanticModelBehaviors(metrics = {}) {
  metrics.semanticModelBehaviors = [];
  return 0;
}

export function loadStoredPreviewSemanticModelBehaviors(storage = null, storageKey = PREVIEW_SEMANTIC_MODEL_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((behavior) => normalizePreviewSemanticModelBehavior(behavior))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function persistPreviewSemanticModelBehaviors(
  storage = null,
  behaviors = [],
  storageKey = PREVIEW_SEMANTIC_MODEL_STORAGE_KEY,
) {
  if (!storage || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
    return 0;
  }
  const normalizedBehaviors = (Array.isArray(behaviors) ? behaviors : [behaviors])
    .map((behavior) => normalizePreviewSemanticModelBehavior(behavior))
    .filter(Boolean);
  try {
    if (normalizedBehaviors.length === 0) {
      storage.removeItem(storageKey);
      return 0;
    }
    storage.setItem(storageKey, JSON.stringify(normalizedBehaviors));
    return normalizedBehaviors.length;
  } catch (_) {
    return normalizedBehaviors.length;
  }
}

export function consumePreviewSemanticModelBehavior(metrics = {}, modelRef = "") {
  const behaviors = ensureMetricsBehaviors(metrics);
  const normalizedRef = String(modelRef || "").trim();
  const index = behaviors.findIndex((behavior) => {
    if (!behavior || typeof behavior !== "object") {
      return false;
    }
    const match = behavior.match && typeof behavior.match === "object" ? behavior.match : {};
    if (String(match.modelRef || "").trim() && String(match.modelRef || "").trim() !== normalizedRef) {
      return false;
    }
    return true;
  });
  if (index === -1) {
    return null;
  }
  const [behavior] = behaviors.splice(index, 1);
  return behavior || null;
}

export async function applyPreviewSemanticModelBehavior(metrics = {}, modelRef = "") {
  const behavior = consumePreviewSemanticModelBehavior(metrics, modelRef);
  if (!behavior || typeof behavior !== "object") {
    return null;
  }
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const errorMessage = String(behavior.error?.message || behavior.errorMessage || behavior.error || "").trim();
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  if (!behavior.result || typeof behavior.result !== "object" || Array.isArray(behavior.result)) {
    return null;
  }
  return clonePreviewValue(behavior.result);
}

export function attachPreviewSemanticModelBehaviorApi(metrics = {}) {
  metrics.replaceSemanticModelBehaviors = function replaceSemanticModelBehaviors(nextBehaviors = []) {
    return replacePreviewSemanticModelBehaviors(metrics, nextBehaviors);
  };
  metrics.queueSemanticModelBehavior = function queueSemanticModelBehavior(nextBehavior = {}) {
    return queuePreviewSemanticModelBehavior(metrics, nextBehavior);
  };
  metrics.clearSemanticModelBehaviors = function clearSemanticModelBehaviors() {
    return clearPreviewSemanticModelBehaviors(metrics);
  };
  return metrics;
}
