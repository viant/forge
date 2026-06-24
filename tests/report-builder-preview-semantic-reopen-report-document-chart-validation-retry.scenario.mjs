import {
  buildClearSemanticValidationBehaviorsStep,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
  buildSemanticValidationBehaviorInjectionSteps,
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
      text: "Selected entry: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    buildSemanticValidationBehaviorInjectionSteps({
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["available_impressions"],
      },
      errorMessage: "Semantic provider unavailable.",
    }),
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityTrendQ3",
      responseTitle: "Get ReportDocument response: Capacity Trend Q3",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Semantic validation: Semantic provider unavailable.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Retry validation",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    buildClearSemanticValidationBehaviorsStep(),
    {
      type: "clickRole",
      role: "button",
      name: "Retry validation",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || text.includes('Avails by Date and Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return !text.includes('Semantic validation: Semantic provider unavailable.') && !text.includes('Retry validation') && text.includes('Avails by Date and Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-validation-retry.png",
      fullPage: true,
    },
  ],
};
