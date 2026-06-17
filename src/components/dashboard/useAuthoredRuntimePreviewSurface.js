import { useReportRuntimePreviewHandlers } from "./useReportRuntimePreviewHandlers.js";

export function buildAuthoredRuntimePreviewSurface(interaction = null, runtimeHandlers = null) {
  return {
    hostIntent: interaction?.hostIntent ?? null,
    detailDiagnostic: interaction?.detailDiagnostic ?? null,
    canUndoInteraction: interaction?.canUndoInteraction ?? false,
    canRedoInteraction: interaction?.canRedoInteraction ?? false,
    applyRefinement: interaction?.applyRefinement ?? null,
    undoInteractionState: interaction?.undoInteractionState ?? null,
    redoInteractionState: interaction?.redoInteractionState ?? null,
    replaceInteractionState: interaction?.replaceInteractionState ?? null,
    clearDetailState: interaction?.clearDetailState ?? null,
    clearInteractionState: interaction?.clearInteractionState ?? null,
    runtimeHandlers,
  };
}

export function useAuthoredRuntimePreviewSurface({
  interaction = null,
  semanticModelHandler = null,
  reportSpec = {},
  detailDescription = "Ready for host routing from the authored runtime preview.",
} = {}) {
  const { runtimeHandlers } = useReportRuntimePreviewHandlers({
    interaction,
    semanticModelHandler,
    reportSpec,
    detailDescription,
  });
  return buildAuthoredRuntimePreviewSurface(interaction, runtimeHandlers);
}
