import assert from "node:assert/strict";

import { buildAuthoredRuntimePreviewSurface } from "./useAuthoredRuntimePreviewSurface.js";

const applyRefinement = () => "apply";
const undoInteractionState = () => "undo";
const redoInteractionState = () => "redo";
const replaceInteractionState = () => "replace";
const clearDetailState = () => "clear-detail";
const clearInteractionState = () => "clear";
const runtimeHandlers = {
  applyRefinement,
  clearRefinements: clearInteractionState,
};

assert.deepEqual(buildAuthoredRuntimePreviewSurface(null, runtimeHandlers), {
  hostIntent: null,
  detailDiagnostic: null,
  canUndoInteraction: false,
  canRedoInteraction: false,
  applyRefinement: null,
  undoInteractionState: null,
  redoInteractionState: null,
  replaceInteractionState: null,
  clearDetailState: null,
  clearInteractionState: null,
  runtimeHandlers,
});

assert.deepEqual(buildAuthoredRuntimePreviewSurface({
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Missing parameter campaign.",
  },
  canUndoInteraction: true,
  canRedoInteraction: false,
  applyRefinement,
  undoInteractionState,
  redoInteractionState,
  replaceInteractionState,
  clearDetailState,
  clearInteractionState,
  ignored: true,
}, runtimeHandlers), {
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://example/performance/channel-detail",
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Missing parameter campaign.",
  },
  canUndoInteraction: true,
  canRedoInteraction: false,
  applyRefinement,
  undoInteractionState,
  redoInteractionState,
  replaceInteractionState,
  clearDetailState,
  clearInteractionState,
  runtimeHandlers,
});

console.log("useAuthoredRuntimePreviewSurface ✓ projects the minimal authored runtime preview surface");
