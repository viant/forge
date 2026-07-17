import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
  buildClearSemanticValidationBehaviorsStep,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
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
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Q3",
      timeoutMs: 60000,
    },
    buildSemanticValidationBehaviorInjectionSteps({
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["channel"],
        measures: ["available_impressions", "household_uniques"],
      },
      errorMessage: "Semantic provider unavailable.",
    }),
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Q3",
      reportId: "capacityQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Inventory Ladder'); })()",
      timeoutMs: 60000,
    },
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
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Channel",
      measureText: "Measures Available Impressions, Household Uniques",
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Inventory Ladder' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
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
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Inventory Ladder'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return !text.includes('Semantic validation: Semantic provider unavailable.') && !text.includes('Retry validation') && (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Inventory Ladder'); })()",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Channel",
      measureText: "Measures Available Impressions, Household Uniques",
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Inventory Ladder' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-validation-retry.png",
      fullPage: true,
    },
  ],
};
