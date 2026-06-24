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
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
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
      name: "Check reopen compatibility",
    },
    {
      type: "waitForDomContains",
      text: "Reopen diagnostic: Capacity Archive",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.reopenDiagnostic",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect reopen diagnostic",
    },
    {
      type: "waitForDomContains",
      text: "Historical Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Archived report entry used for reopen compatibility diagnostics.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "reportBuilder.reopenDiagnostic",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"code\": \"incompatibleSource\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"responseKind\": \"listReportDocumentsResponse\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"builderTarget\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 7",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"state\": {",
    },
    {
      type: "assertDomNotContains",
      text: "\"config\": {",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide reopen diagnostic",
    },
    {
      type: "assertDomNotContains",
      text: "\"code\": \"incompatibleSource\"",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-diagnostic.png",
      fullPage: true,
    },
  ],
};
