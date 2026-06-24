import {
  buildClearDetailTargetBehaviorsSteps,
  buildDetailTargetBehaviorNullResultSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartActionSelectionSteps,
  buildRuntimeResolvedDetailTargetWaitSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      responseTitle: "Get ReportDocument response: Capacity Locations Top Markets Q3",
    }),
    ...buildDetailTargetBehaviorNullResultSteps({
      targetRef: "target://example/performance/market-detail",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec == null",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
    }),
    ...buildRuntimeChartActionSelectionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show market details",
      selectedValueTexts: [
        "Selected value:",
        "US",
      ],
      clickMarkIndex: 0,
    }),
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/market-detail",
        "country",
        "US",
        "Runtime Diagnostics",
      ],
      requireHostIntent: true,
    }),
    ...buildClearDetailTargetBehaviorsSteps(),
    ...buildRuntimeChartActionSelectionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show market details",
      selectedValueTexts: [
        "Selected value:",
        "CA",
      ],
      clickMarkIndex: 1,
    }),
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/market-detail",
        "country",
        "CA",
      ],
      forbiddenTexts: [
        "No detail target resolved",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-detail-recovery.png",
      fullPage: true,
    },
  ],
};
