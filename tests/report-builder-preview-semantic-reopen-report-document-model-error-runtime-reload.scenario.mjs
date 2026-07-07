import {
  buildAuthoredRuntimeSemanticSurfaceAbsentStep,
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceSemanticModelBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceSemanticModelBehaviors([{ match: { modelRef: 'model://example/performance/delivery@v1' }, error: 'Semantic model metadata failed.' }]);",
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic model error: Semantic model metadata failed.",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceAbsentStep({
      requiredTexts: ["Capacity Trend Q3"],
      forbiddenTexts: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
      ],
    }),
    {
      type: "waitForEval",
      expression: "(() => { const metrics = window.__REPORT_BUILDER_PREVIEW__; return !!metrics && Number(metrics.getModelCount || 0) >= 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry model load')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Retry model load",
    },
    {
      type: "waitForEval",
      expression: "(() => { const metrics = window.__REPORT_BUILDER_PREVIEW__; return !!metrics && Number(metrics.getModelCount || 0) >= 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Semantic model error: Semantic model metadata failed.",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Compiled Report Runtime Preview",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date, Channel",
      measureText: "Measures Available Impressions",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-model-error-runtime-reload.png",
      fullPage: true,
    },
  ],
};
