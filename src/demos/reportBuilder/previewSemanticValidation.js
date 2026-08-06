function clonePreviewValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export const PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY = "forge.reportBuilderPreview.semanticValidationBehaviors";

export function normalizePreviewSemanticSelectionIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

export function previewSemanticSelectionIdsEqual(left = [], right = []) {
  const normalizedLeft = normalizePreviewSemanticSelectionIds(left);
  const normalizedRight = normalizePreviewSemanticSelectionIds(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function normalizePreviewSemanticValidationBehavior(behavior = {}) {
  if (!behavior || typeof behavior !== 'object') {
    return null;
  }
  const match = behavior.match && typeof behavior.match === 'object' ? behavior.match : {};
  const normalizedMatch = {
    ...(String(match.modelRef || '').trim() ? { modelRef: String(match.modelRef).trim() } : {}),
    ...(String(match.entity || '').trim() ? { entity: String(match.entity).trim() } : {}),
    ...(Array.isArray(match.dimensions) ? { dimensions: normalizePreviewSemanticSelectionIds(match.dimensions) } : {}),
    ...(Array.isArray(match.measures) ? { measures: normalizePreviewSemanticSelectionIds(match.measures) } : {}),
  };
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  const errorMessage = String(behavior.error?.message || behavior.errorMessage || behavior.error || '').trim();
  const result = behavior.result && typeof behavior.result === 'object'
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
  const currentBehaviors = Array.isArray(metrics.semanticValidationBehaviors)
    ? metrics.semanticValidationBehaviors
    : [];
  metrics.semanticValidationBehaviors = currentBehaviors;
  return currentBehaviors;
}

export function replacePreviewSemanticValidationBehaviors(metrics = {}, nextBehaviors = []) {
  metrics.semanticValidationBehaviors = (Array.isArray(nextBehaviors) ? nextBehaviors : [nextBehaviors])
    .map((behavior) => normalizePreviewSemanticValidationBehavior(behavior))
    .filter(Boolean);
  return metrics.semanticValidationBehaviors.length;
}

export function queuePreviewSemanticValidationBehavior(metrics = {}, nextBehavior = {}) {
  const behavior = normalizePreviewSemanticValidationBehavior(nextBehavior);
  const currentBehaviors = ensureMetricsBehaviors(metrics);
  if (!behavior) {
    return currentBehaviors.length;
  }
  metrics.semanticValidationBehaviors = [...currentBehaviors, behavior];
  return metrics.semanticValidationBehaviors.length;
}

export function clearPreviewSemanticValidationBehaviors(metrics = {}) {
  metrics.semanticValidationBehaviors = [];
  return 0;
}

export function loadStoredPreviewSemanticValidationBehaviors(storage = null, storageKey = PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((behavior) => normalizePreviewSemanticValidationBehavior(behavior))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function persistPreviewSemanticValidationBehaviors(
  storage = null,
  behaviors = [],
  storageKey = PREVIEW_SEMANTIC_VALIDATION_STORAGE_KEY,
) {
  if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    return 0;
  }
  const normalizedBehaviors = (Array.isArray(behaviors) ? behaviors : [behaviors])
    .map((behavior) => normalizePreviewSemanticValidationBehavior(behavior))
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

export function consumePreviewSemanticValidationBehavior(metrics = {}, modelRef = '', selection = {}) {
  const behaviors = ensureMetricsBehaviors(metrics);
  const normalizedRef = String(modelRef || '').trim();
  const normalizedEntity = String(selection?.entity || '').trim();
  const normalizedDimensions = normalizePreviewSemanticSelectionIds(selection?.dimensions);
  const normalizedMeasures = normalizePreviewSemanticSelectionIds(selection?.measures);
  const index = behaviors.findIndex((behavior) => {
    if (!behavior || typeof behavior !== 'object') {
      return false;
    }
    const match = behavior.match && typeof behavior.match === 'object' ? behavior.match : {};
    if (String(match.modelRef || '').trim() && String(match.modelRef || '').trim() !== normalizedRef) {
      return false;
    }
    if (String(match.entity || '').trim() && String(match.entity || '').trim() !== normalizedEntity) {
      return false;
    }
    if (Array.isArray(match.dimensions) && !previewSemanticSelectionIdsEqual(match.dimensions, normalizedDimensions)) {
      return false;
    }
    if (Array.isArray(match.measures) && !previewSemanticSelectionIdsEqual(match.measures, normalizedMeasures)) {
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

export async function applyPreviewSemanticValidationBehavior(metrics = {}, modelRef = '', selection = {}) {
  const behavior = consumePreviewSemanticValidationBehavior(metrics, modelRef, selection);
  if (!behavior || typeof behavior !== 'object') {
    return null;
  }
  const delayMs = Math.max(0, Number(behavior.delayMs || 0) || 0);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const errorMessage = String(behavior.error?.message || behavior.errorMessage || behavior.error || '').trim();
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  if (!behavior.result || typeof behavior.result !== 'object') {
    return null;
  }
  return {
    valid: behavior.result.valid === true,
    normalizedSelection: behavior.result.normalizedSelection && typeof behavior.result.normalizedSelection === 'object'
      ? clonePreviewValue(behavior.result.normalizedSelection)
      : null,
    diagnostics: Array.isArray(behavior.result.diagnostics)
      ? clonePreviewValue(behavior.result.diagnostics)
      : [],
  };
}

export function attachPreviewSemanticValidationBehaviorApi(metrics = {}) {
  metrics.replaceSemanticValidationBehaviors = function replaceSemanticValidationBehaviors(nextBehaviors = []) {
    return replacePreviewSemanticValidationBehaviors(metrics, nextBehaviors);
  };
  metrics.queueSemanticValidationBehavior = function queueSemanticValidationBehavior(nextBehavior = {}) {
    return queuePreviewSemanticValidationBehavior(metrics, nextBehavior);
  };
  metrics.clearSemanticValidationBehaviors = function clearSemanticValidationBehaviors() {
    return clearPreviewSemanticValidationBehaviors(metrics);
  };
  return metrics;
}
