import React from "react";

import {
  buildReportRuntimeHandlers,
  createReportRuntimeDetailTargetOpener,
  resolveReportRuntimePreviewDetailProvider,
} from "./reportRuntimePreviewHandlers.js";

export function useReportRuntimePreviewHandlers({
  interaction = null,
  semanticModelHandler = null,
  reportSpec = {},
  detailDescription = "Ready for host routing from the authored runtime preview.",
} = {}) {
  const drillMetadataProvider = React.useMemo(
    () => resolveReportRuntimePreviewDetailProvider({
      semanticModelHandler,
      reportSpec,
    }),
    [reportSpec, semanticModelHandler],
  );
  const openDetailTarget = React.useMemo(
    () => createReportRuntimeDetailTargetOpener({
      drillMetadataProvider,
      setHostIntent: interaction?.setHostIntent,
      setDetailDiagnostic: interaction?.setDetailDiagnostic,
      description: detailDescription,
    }),
    [detailDescription, drillMetadataProvider, interaction?.setDetailDiagnostic, interaction?.setHostIntent],
  );
  const runtimeHandlers = React.useMemo(
    () => buildReportRuntimeHandlers({
      applyRefinement: interaction?.applyRefinement,
      applyDrillTransition: interaction?.applyDrillTransition,
      removeRefinement: interaction?.removeRefinementById,
      clearRefinements: interaction?.clearRefinements,
      undoRefinements: interaction?.undoInteractionState,
      redoRefinements: interaction?.redoInteractionState,
      canUndoRefinements: interaction?.canUndoInteraction === true,
      canRedoRefinements: interaction?.canRedoInteraction === true,
      clearHostIntent: interaction?.clearHostIntent,
      clearDetailDiagnostic: interaction?.clearDetailDiagnostic,
      clearDetailState: interaction?.clearDetailState,
      openDetailTarget,
      drillMetadataProvider,
    }),
    [
      interaction?.applyDrillTransition,
      interaction?.applyRefinement,
      interaction?.canRedoInteraction,
      interaction?.canUndoInteraction,
      interaction?.clearDetailDiagnostic,
      interaction?.clearDetailState,
      interaction?.clearHostIntent,
      interaction?.clearRefinements,
      interaction?.removeRefinementById,
      interaction?.redoInteractionState,
      interaction?.undoInteractionState,
      drillMetadataProvider,
      openDetailTarget,
    ],
  );
  return {
    drillMetadataProvider,
    openDetailTarget,
    runtimeHandlers,
  };
}
