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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceSemanticModelBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceSemanticModelBehaviors([{ match: { modelRef: 'model://example/performance/delivery@v1' }, error: 'Semantic model metadata failed.' }]);",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic model error: Semantic model metadata failed.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3",
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
      text: "Dimensions Delivery Date, Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions",
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
      type: "waitForDomContains",
      text: "\"semanticSummary\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"modelLabel\": \"Ad Delivery\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"entityLabel\": \"Line Delivery\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"expectedVersion\": 6",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-model-error-update-payload.png",
      fullPage: true,
    },
  ],
};
