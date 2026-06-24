import {
  buildPreviewBootstrapSteps,
  buildReopenedCompileDiagnosticsWaitSteps,
  buildReopenedHydratedSessionVerificationSteps,
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
      reportId: "capacityLocationsTopMarketsQ3",
      compileState: {
        status: "invalid",
        diagnostics: [
          {
            code: "semanticGovernance",
            severity: "warning",
            message: "Market • Deprecated",
          },
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
      timeoutMs: 15000,
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
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    ...buildReopenedCompileDiagnosticsWaitSteps({
      texts: [
        "Primary Chart is no longer compatible with the current builder selection.",
        "Edit the chart block to reselect the current breakdowns/measures or restore the missing chart fields in the builder.",
        "documentBlockChartInvalid",
        "Block primaryChart",
        "reportDocument.blocks.primaryChart.chartSpec.xField",
      ],
    }),
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Primary Chart is no longer compatible with the current builder selection.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentReopenSession?.reopenedCompileState?.status === 'invalid'; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-actionable-diagnostics.png",
      fullPage: true,
    },
  ],
};
