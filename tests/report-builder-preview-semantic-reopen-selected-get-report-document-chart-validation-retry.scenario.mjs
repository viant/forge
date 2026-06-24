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
    {
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 5000,
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
    buildSemanticValidationBehaviorInjectionSteps({
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["available_impressions"],
      },
      errorMessage: "Semantic provider unavailable.",
    }),
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityTrendQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"reportId\": \"capacityTrendQ3\"",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityTrendQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"documentVersion\": 6",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 6",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 6,
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-selected-get-report-document-chart-validation-retry.png",
      fullPage: true,
    },
  ],
};
