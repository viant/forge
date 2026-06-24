import {
  buildClearDetailTargetBehaviorsSteps,
  buildDetailTargetBehaviorInjectionSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeDetailTargetFailureSteps,
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
      reportId: "capacityLocationQ3",
      responseTitle: "Get ReportDocument response: Capacity Location Q3",
    }),
    ...buildDetailTargetBehaviorInjectionSteps({
      targetRef: "target://example/performance/market-detail",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'] })",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Location Q3",
      reportId: "capacityLocationQ3",
      documentVersion: 11,
    }),
    ...buildRuntimeDetailTargetFailureSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show market details",
      failureTargetRef: "target://example/performance/market-detail",
    }),
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show market details",
      index: 1,
    },
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
        "Detail target resolution failed.",
        "Failed to resolve detail target",
      ],
      requireHostIntent: true,
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-table-detail-error-recovery.png",
      fullPage: true,
    },
  ],
};
