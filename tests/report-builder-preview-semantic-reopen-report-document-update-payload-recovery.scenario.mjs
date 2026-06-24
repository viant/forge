import {
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
      value: "capacityTrendQ3",
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
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
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
    buildClearSemanticValidationBehaviorsStep(),
    {
      type: "clickRole",
      role: "button",
      name: "Retry validation",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return !text.includes('Semantic validation: Semantic provider unavailable.') && !text.includes('Retry validation') && text.includes('Avails by Date and Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ viewMode: 'table' })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table'",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Expected version\"]",
      value: "6",
    },
    {
      type: "waitForDomContains",
      text: "Using expected version 6.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare update payload",
    },
    {
      type: "waitForDomContains",
      text: "Update ReportDocument payload: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const summary = document.querySelector('[aria-label=\"Update ReportDocument payload summary\"]'); const text = summary?.innerText || summary?.textContent || ''; return text.includes('UPDATEREPORTDOCUMENTPAYLOAD') && text.includes('CAPACITYTRENDQ3') && text.includes('V6'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const summary = document.querySelector('[aria-label=\"Update ReportDocument payload summary\"]'); const container = summary?.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('.forge-report-builder__saved-artifact-json'); const text = pre?.innerText || pre?.textContent || ''; return text.includes('\"expectedVersion\": 6') && text.includes('\"viewMode\": \"table\"') && text.includes('\"semanticSummary\": {') && text.includes('\"modelLabel\": \"Ad Delivery\"') && text.includes('\"entityLabel\": \"Line Delivery\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-update-payload-recovery.png",
      fullPage: true,
    },
  ],
};
