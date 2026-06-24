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
      reportId: "capacityLocationQ3",
      compileState: {
        status: "invalid",
        diagnostics: [
          {
            code: "semanticGovernance",
            severity: "warning",
            message: "Market • Deprecated",
          },
          {
            code: "documentBlockColumnUnavailable",
            severity: "error",
            blockId: "primaryTable",
            path: "reportDocument.blocks.primaryTable.columns[0]",
            message: 'Primary Table references unavailable table column "country".',
            suggestedFix: "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
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
      reportId: "capacityLocationQ3",
      responseTitle: "Get ReportDocument response: Capacity Location Q3",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Location Q3",
      reportId: "capacityLocationQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    ...buildReopenedCompileDiagnosticsWaitSteps({
      texts: [
        "Primary Table references unavailable table column",
        "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
        "documentBlockColumnUnavailable",
        "Block primaryTable",
        "reportDocument.blocks.primaryTable.columns[0]",
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
      text: "Reopened ReportDocument: Capacity Location Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Primary Table references unavailable table column",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentReopenSession?.reopenedCompileState?.status === 'invalid'; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-actionable-diagnostics.png",
      fullPage: true,
    },
  ],
};
