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
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reach Rate'))",
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
      reportId: "capacityInventoryTopChannelsQ3",
      responseTitle: "Get ReportDocument response: Capacity Inventory Top Channels Q3",
    }),
    ...buildDetailTargetBehaviorInjectionSteps({
      targetRef: "target://example/performance/channel-detail",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Inventory Top Channels Q3",
      reportId: "capacityInventoryTopChannelsQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    ...buildRuntimeDetailTargetFailureSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show channel details",
      failureTargetRef: "target://example/performance/channel-detail",
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show channel details",
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
        "target://example/performance/channel-detail",
        "CTV",
      ],
      forbiddenTexts: [
        "Detail target resolution failed.",
        "Failed to resolve detail target",
      ],
      requireHostIntent: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-chart-detail-error-recovery.png",
      fullPage: true,
    },
  ],
};
