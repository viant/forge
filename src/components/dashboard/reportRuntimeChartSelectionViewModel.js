import { resolveReportRuntimeChartSelectionSummary } from "./reportRuntimeChartActionModel.js";

export function buildReportRuntimeChartSelectionViewModel({
  blockTitle = "",
  selection = null,
  actions = [],
  interactionSupport = null,
  canClearSelection = false,
} = {}) {
  if (interactionSupport && interactionSupport.enabled === false) {
    return {
      kind: "unsupported",
      message: interactionSupport.message,
    };
  }
  if (!selection || !Array.isArray(actions) || actions.length === 0) {
    return {
      kind: "idle",
      message: interactionSupport?.legendEnabled
        ? "Click a chart mark or series legend to apply authored runtime actions."
        : "Click a chart mark to apply authored runtime actions.",
    };
  }
  return {
    kind: "selected",
    summary: resolveReportRuntimeChartSelectionSummary({
      blockTitle,
      selection,
    }),
    actions,
    canClearSelection: canClearSelection === true,
  };
}
