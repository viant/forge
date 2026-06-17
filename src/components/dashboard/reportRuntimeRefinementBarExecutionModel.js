function normalizeString(value = "") {
  return String(value || "").trim();
}

export function buildReportRuntimeRefinementBarRemoveExecution({
  blockId = "",
  refinement = null,
} = {}) {
  const normalizedRefinementId = normalizeString(refinement?.id);
  if (!normalizedRefinementId) {
    return null;
  }
  const normalizedBlockId = normalizeString(blockId || refinement?.sourceBlockId || "refinementBar");
  return {
    id: `removeRefinement:${normalizedBlockId}:${normalizedRefinementId}`,
    label: "Remove refinement",
    kind: "removeRefinement",
    refinementId: normalizedRefinementId,
    sourceBlockId: normalizedBlockId,
  };
}

export function buildReportRuntimeRefinementBarClearExecution({
  blockId = "",
} = {}) {
  const normalizedBlockId = normalizeString(blockId || "refinementBar");
  return {
    id: `clearRefinements:${normalizedBlockId}`,
    label: "Clear all refinements",
    kind: "clearRefinements",
    sourceBlockId: normalizedBlockId,
  };
}

export function buildReportRuntimeRefinementBarUndoExecution({
  blockId = "",
} = {}) {
  const normalizedBlockId = normalizeString(blockId || "refinementBar");
  return {
    id: `undoRefinements:${normalizedBlockId}`,
    label: "Undo refinement changes",
    kind: "undoRefinements",
    sourceBlockId: normalizedBlockId,
  };
}

export function buildReportRuntimeRefinementBarRedoExecution({
  blockId = "",
} = {}) {
  const normalizedBlockId = normalizeString(blockId || "refinementBar");
  return {
    id: `redoRefinements:${normalizedBlockId}`,
    label: "Redo refinement changes",
    kind: "redoRefinements",
    sourceBlockId: normalizedBlockId,
  };
}
