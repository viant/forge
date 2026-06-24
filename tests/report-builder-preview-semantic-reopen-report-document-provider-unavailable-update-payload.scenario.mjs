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
      includeSummaryNotice: true,
    }),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.setSemanticModelProviderAvailable !== 'function') { throw new Error('setSemanticModelProviderAvailable API not available.'); } return preview.setSemanticModelProviderAvailable(false); })()",
    },
    {
      type: "waitForDomContains",
      text: "Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const retryButton = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry model load')); return text.includes('Reopened ReportDocument: Capacity Trend Q3') && !retryButton; })()",
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
      expression: "(() => { const summary = document.querySelector('[aria-label=\"Update ReportDocument payload summary\"]'); const container = summary?.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('.forge-report-builder__saved-artifact-json'); const text = pre?.innerText || pre?.textContent || ''; return text.includes('\"expectedVersion\": 6') && text.includes('\"semanticSummary\": {') && text.includes('\"modelRef\": \"model://example/performance/delivery@v1\"') && text.includes('\"entity\": \"line_delivery\"') && !text.includes('\"modelLabel\": \"Ad Delivery\"') && !text.includes('\"entityLabel\": \"Line Delivery\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-provider-unavailable-update-payload.png",
      fullPage: true,
    },
  ],
};
