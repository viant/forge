import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
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
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityLocationQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Location Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityLocationQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Location Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 5",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'] })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate'",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Location Q3",
      reportId: "capacityLocationQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('avails') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('hhUniqs') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('reachRate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Location Ladder' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Location Ladder'))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Entity Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Dimensions Market",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions, Household Uniques",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Region",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Region",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Region = US'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Region') && !labels.includes('Market'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Metro Area",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Metro Area = West'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Metro Area') && !labels.includes('Region'); })()",
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
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Location Ladder' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const overlay = document.querySelector('.forge-report-builder__overlay-backdrop'); if (overlay) { overlay.click(); } })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Restore live builder",
    },
    {
      type: "waitForDomContains",
      text: "Restored the live builder state from before reopening the saved ReportDocument.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-response.png",
      fullPage: true,
    },
  ],
};
