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
      type: "eval",
      expression: "window.sessionStorage && window.sessionStorage.clear && window.sessionStorage.clear();",
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
      type: "eval",
      expression: "(() => { const close = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Close')); if (close) { close.click(); } return true; })()",
    },
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
      expression: "(() => { const preview = document.querySelector('[aria-label=\"Authored runtime preview\"]'); const text = preview?.innerText || preview?.textContent || ''; const retryButton = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry model load')); return !!preview && text.includes('Capacity Trend Q3') && text.includes('Compile the authored runtime preview') && !text.includes('Model Ad Delivery') && !text.includes('Entity Line Delivery') && !retryButton; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; preview.__providerUnavailableBeforeRestore = Number(preview.getModelCount || 0); return preview.setSemanticModelProviderAvailable(true); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const metrics = window.__REPORT_BUILDER_PREVIEW__; return !!metrics && Number(metrics.getModelCount || 0) > Number(metrics.__providerUnavailableBeforeRestore || 0); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = document.querySelector('[aria-label=\"Authored runtime preview\"]'); const text = preview?.innerText || preview?.textContent || ''; return !!preview && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview.png",
      fullPage: true,
    },
  ],
};
