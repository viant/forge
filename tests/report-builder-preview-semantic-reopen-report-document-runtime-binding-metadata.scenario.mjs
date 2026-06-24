import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 1400,
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
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentRequest\"",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Governed reporting model for the report builder preview.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Daily delivery grain",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Approved buying channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Certified available inventory",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = (panel?.innerText || panel?.textContent || ''); return text.includes('SELECTED MEASURES (1)') && text.includes('CERTIFIED') && text.includes('REVIEWED'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-runtime-binding-metadata.png",
      fullPage: true,
    },
  ],
};
