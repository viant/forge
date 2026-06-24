import {
  buildPreviewBootstrapSteps,
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
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[aria-label=\"List ReportDocuments response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"listReportDocumentsResponse\"') && text.includes('\"cursor\": \"next-page\"') && text.includes('\"hasMore\": true') && text.includes('\"title\": \"Capacity Q3\"') && text.includes('\"title\": \"Capacity Archive\"') && text.includes('\"title\": \"Capacity Location Q3\"') && text.includes('\"title\": \"Capacity Trend Q3\"') && text.includes('\"title\": \"Capacity Inventory Top Channels Q3\"') && text.includes('\"title\": \"Capacity Locations Top Markets Q3\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"document\": {",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide list response",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-report-documents-response.png",
      fullPage: true,
    },
  ],
};
