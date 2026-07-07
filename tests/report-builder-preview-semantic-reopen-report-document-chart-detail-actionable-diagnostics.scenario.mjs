import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildPreviewPatchReopenedCompileStateStep,
  buildClearDetailTargetBehaviorsSteps,
  buildDetailTargetBehaviorInjectionSteps,
  buildPreviewBootstrapSteps,
  buildReopenedCompileDiagnosticsWaitSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartDetailTargetFailureSteps,
  buildRuntimeChartDetailTargetResolutionSteps,
  buildSavedPayloadPreparationSteps,
  buildSeededSavedPayloadCompileStatePatchSteps,
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
    ...buildSeededSavedPayloadCompileStatePatchSteps({
      reportId: "capacityTrendQ3",
      compileState: {
        status: "invalid",
        diagnostics: [
          {
            code: "documentBlockChartInvalid",
            severity: "error",
            blockId: "primaryChart",
            path: "reportDocument.blocks.primaryChart.chartSpec.xField",
            message: "Primary Chart is no longer compatible with the current builder selection.",
            suggestedFix: "Edit the chart block to reselect the current breakdowns/measures or restore the missing chart fields in the builder.",
          },
        ],
      },
      statusText: "INVALID",
    }),
    {
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 5000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
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
      reportId: "capacityTrendQ3",
      responseTitle: "Get ReportDocument response: Capacity Trend Q3",
    }),
    ...buildDetailTargetBehaviorInjectionSteps({
      targetRef: "target://example/performance/channel-detail",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
    }),
    ...buildReopenedCompileDiagnosticsWaitSteps({
      texts: [
        "Primary Chart is no longer compatible with the current builder selection.",
        "Edit the chart block to reselect the current breakdowns/measures or restore the missing chart fields in the builder.",
        "documentBlockChartInvalid",
        "Block primaryChart",
        "reportDocument.blocks.primaryChart.chartSpec.xField",
      ],
    }),
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date, Channel",
      measureText: "Measures Available Impressions",
    }),
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show channel details",
      index: 0,
    },
    ...buildRuntimeChartDetailTargetFailureSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show channel details",
      selectedValueTexts: [
        "Selected value:",
        "Display",
      ],
      failureTargetRef: "target://example/performance/channel-detail",
    }),
    {
      type: "waitForDomContains",
      text: "Primary Chart is no longer compatible with the current builder selection.",
      timeoutMs: 60000,
    },
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show channel details",
      index: 1,
    },
    ...buildRuntimeChartDetailTargetResolutionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show channel details",
      selectedValueTexts: [
        "Selected value:",
        "CTV",
      ],
      expectedTexts: [
        "target://example/performance/channel-detail",
        "CTV",
      ],
      forbiddenTexts: [
        "Detail target resolution failed.",
        "Failed to resolve detail target",
      ],
    }),
    {
      type: "waitForDomContains",
      text: "Primary Chart is no longer compatible with the current builder selection.",
      timeoutMs: 60000,
    },
    buildPreviewPatchReopenedCompileStateStep({
      compileState: {
        status: "clean",
        diagnostics: [],
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentReopenSession?.reopenedCompileState?.status === 'clean'; })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Reopened compile diagnostics",
    },
    {
      type: "assertDomNotContains",
      text: "Runtime Diagnostics",
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date, Channel",
      measureText: "Measures Available Impressions",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-detail-actionable-diagnostics.png",
      fullPage: true,
    },
  ],
};
