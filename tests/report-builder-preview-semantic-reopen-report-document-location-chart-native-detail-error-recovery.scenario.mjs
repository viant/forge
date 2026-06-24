import {
  buildClearDetailTargetBehaviorsSteps,
  buildDetailTargetBehaviorInjectionSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartDetailTargetFailureSteps,
  buildRuntimeChartDetailTargetResolutionSteps,
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
    {
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 30000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      responseTitle: "Get ReportDocument response: Capacity Locations Top Markets Q3",
    }),
    ...buildDetailTargetBehaviorInjectionSteps({
      targetRef: "target://example/performance/market-detail",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .recharts-bar-rectangle').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__runtime-preview .recharts-bar-rectangle",
      index: 0,
    },
    ...buildRuntimeChartDetailTargetFailureSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show market details",
      selectedValueTexts: [
        "Selected value:",
        "US",
      ],
      failureTargetRef: "target://example/performance/market-detail",
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "clickSelector",
      selector: ".forge-report-builder__runtime-preview .recharts-bar-rectangle",
      index: 1,
    },
    ...buildRuntimeChartDetailTargetResolutionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show market details",
      selectedValueTexts: [
        "Selected value:",
        "CA",
      ],
      expectedTexts: [
        "target://example/performance/market-detail",
        "country",
        "CA",
      ],
      forbiddenTexts: [
        "Detail target resolution failed.",
        "Failed to resolve detail target",
      ],
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-native-detail-error-recovery.png",
      fullPage: true,
    },
  ],
};
