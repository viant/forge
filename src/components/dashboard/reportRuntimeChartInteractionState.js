import { buildReportRuntimeChartActionDescriptors } from "./reportRuntimeChartActionModel.js";
import { buildReportRuntimeChartActionExecutions } from "./reportRuntimeChartExecutionModel.js";
import { buildReportRuntimeChartSelectionViewModel } from "./reportRuntimeChartSelectionViewModel.js";

export function buildReportRuntimeChartInteractionState({
  blockId = "",
  blockTitle = "",
  fields = [],
  selection = null,
  providerActionsByField = new Map(),
  interactionSupport = null,
  canClearSelection = false,
} = {}) {
  const descriptors = buildReportRuntimeChartActionDescriptors({
    blockId,
    fields,
    selection,
    providerActionsByField,
  });
  const executions = buildReportRuntimeChartActionExecutions({
    blockId,
    descriptors,
    fields,
    selection,
  });
  const actionSummaries = executions.map((entry) => ({
    id: entry.id,
    label: entry.label,
    kind: entry.kind,
  }));
  const viewModel = buildReportRuntimeChartSelectionViewModel({
    blockTitle,
    selection,
    actions: actionSummaries,
    interactionSupport,
    canClearSelection,
  });
  return {
    descriptors,
    executions,
    viewModel,
  };
}
