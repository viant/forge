function normalizeString(value = "") {
  return String(value || "").trim();
}

export function normalizeReportRuntimeDrillTransition(transition = {}) {
  if (!transition || typeof transition !== "object" || Array.isArray(transition)) {
    return null;
  }
  const refinementId = normalizeString(transition.refinementId);
  const sourceField = normalizeString(transition.sourceField);
  const nextFieldRef = normalizeString(transition.nextFieldRef);
  if (!refinementId || !sourceField || !nextFieldRef) {
    return null;
  }
  return {
    refinementId,
    sourceField,
    nextFieldRef,
    ...(normalizeString(transition.sourceBlockId) ? { sourceBlockId: normalizeString(transition.sourceBlockId) } : {}),
  };
}

export function upsertReportRuntimeDrillTransition(transitions = [], transition = null) {
  const normalized = normalizeReportRuntimeDrillTransition(transition);
  if (!normalized) {
    return (Array.isArray(transitions) ? transitions : []).map((entry) => normalizeReportRuntimeDrillTransition(entry)).filter(Boolean);
  }
  const next = (Array.isArray(transitions) ? transitions : [])
    .map((entry) => normalizeReportRuntimeDrillTransition(entry))
    .filter(Boolean)
    .filter((entry) => entry.refinementId !== normalized.refinementId && !(entry.sourceField === normalized.sourceField && entry.sourceBlockId === normalized.sourceBlockId));
  next.push(normalized);
  return next;
}

export function removeReportRuntimeDrillTransition(transitions = [], refinementId = "") {
  const normalizedRefinementId = normalizeString(refinementId);
  return (Array.isArray(transitions) ? transitions : [])
    .map((entry) => normalizeReportRuntimeDrillTransition(entry))
    .filter(Boolean)
    .filter((entry) => entry.refinementId !== normalizedRefinementId);
}

export function clearReportRuntimeDrillTransitions() {
  return [];
}

function resolveChainedDrillField(fieldRef = "", transitions = []) {
  let currentField = normalizeString(fieldRef);
  const visited = new Set();
  while (currentField) {
    if (visited.has(currentField)) {
      return currentField;
    }
    visited.add(currentField);
    const matchingTransition = transitions.find((entry) => entry.sourceField === currentField);
    const nextField = normalizeString(matchingTransition?.nextFieldRef);
    if (!nextField || nextField === currentField) {
      return currentField;
    }
    currentField = nextField;
  }
  return normalizeString(fieldRef);
}

export function applyReportRuntimeDrillTransitions(state = {}, transitions = []) {
  const normalizedTransitions = (Array.isArray(transitions) ? transitions : [])
    .map((entry) => normalizeReportRuntimeDrillTransition(entry))
    .filter(Boolean);
  const selectedDimensions = Array.isArray(state?.selectedDimensions) ? state.selectedDimensions.map((entry) => normalizeString(entry)).filter(Boolean) : [];
  const replacedDimensions = selectedDimensions.map((dimensionId) => resolveChainedDrillField(dimensionId, normalizedTransitions));
  const dedupedDimensions = Array.from(new Set(replacedDimensions));
  const nextGroupBy = (() => {
    const groupBy = normalizeString(state?.groupBy);
    if (!groupBy) {
      return "";
    }
    return resolveChainedDrillField(groupBy, normalizedTransitions);
  })();
  return {
    ...state,
    selectedDimensions: dedupedDimensions,
    ...(nextGroupBy ? { groupBy: nextGroupBy } : { groupBy: state?.groupBy || "" }),
  };
}
