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
      value: "capacityArchive",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Archive",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForDomContains",
      text: "listReportDocumentsResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Prepare the getReportDocument request for the selected list entry before expanding a response.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity Archive",
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
      text: "\"kind\": \"getReportDocumentRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Only entries backed by a local ReportDocument payload can be expanded locally.",
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
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
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
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Prepare the getReportDocument request for the selected list entry before expanding a response.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity Q3",
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
      text: "\"kind\": \"getReportDocumentRequest\"",
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
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentRequest\"",
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 4",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"document\": {",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide get response",
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "demoReportBuilder",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Prepare the getReportDocument request for the selected list entry before expanding a response.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentRequest\"",
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
      text: "\"kind\": \"getReportDocumentRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentRequest\"",
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"demoReportBuilder\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"document\": {",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-get-report-document-response.png",
      fullPage: true,
    },
  ],
};
