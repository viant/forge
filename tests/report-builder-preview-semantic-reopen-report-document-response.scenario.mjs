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
      value: "capacityQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Q3",
      timeoutMs: 60000,
    },
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
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 4",
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
      reportTitle: "Capacity Q3",
      reportId: "capacityQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('avails') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('hhUniqs') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('reachRate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Inventory Ladder' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Inventory Ladder'))()",
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
      text: "Dimensions Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected dimensions (1)",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions, Household Uniques",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Publisher",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Publisher",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Publisher = Display",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Publisher') && !labels.includes('Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Site Type",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Site Type = Acme Media",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Site Type = Acme Media'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel'))[0]?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Site Type') && !labels.includes('Publisher'); })()",
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
      text: "Reopened ReportDocument: Capacity Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.activeTablePreset?.title === 'Inventory Ladder' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
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
      file: "report-builder-preview-semantic-reopen-report-document-response.png",
      fullPage: true,
    },
  ],
};
