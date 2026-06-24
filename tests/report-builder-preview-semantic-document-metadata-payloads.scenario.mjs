import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

function buildDocumentMetadataAuthoringSteps() {
  return [
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Report document title\"]",
      value: "Executive Snapshot",
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Report document subtitle\"]",
      value: "Weekly Rollup",
    },
    {
      type: "fillSelector",
      selector: "textarea[aria-label=\"Report document description\"]",
      value: "Authored payload metadata visibility.",
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').includes('Household Uniques'))); if (!button) { throw new Error('Household Uniques measure button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored payload metadata visibility.",
      timeoutMs: 60000,
    },
  ];
}

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...buildDocumentMetadataAuthoringSteps(),
    {
      type: "clickRole",
      role: "button",
      name: "Prepare create payload",
    },
    {
      type: "waitForDomContains",
      text: "Create ReportDocument payload: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"createReportDocumentPayload\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect create payload",
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Executive Snapshot\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"createReportDocumentPayload\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"subtitle\": \"Weekly Rollup\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"description\": \"Authored payload metadata visibility.\"",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Expected version\"]",
      value: "7",
    },
    {
      type: "waitForDomContains",
      text: "Using expected version 7.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare update payload",
    },
    {
      type: "waitForDomContains",
      text: "Update ReportDocument payload: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"updateReportDocumentPayload\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect update payload",
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Executive Snapshot\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"updateReportDocumentPayload\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"subtitle\": \"Weekly Rollup\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"description\": \"Authored payload metadata visibility.\"",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Current version\"]",
      value: "9",
    },
    {
      type: "waitForDomContains",
      text: "Current version 9 conflicts with expected version 7.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare conflict diagnostic",
    },
    {
      type: "waitForDomContains",
      text: "Update conflict diagnostic: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"updateReportDocumentConflictDiagnostic\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect conflict diagnostic",
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Executive Snapshot\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"subtitle\": \"Weekly Rollup\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"description\": \"Authored payload metadata visibility.\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"updateReportDocumentConflictDiagnostic\"",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-document-metadata-payloads.png",
      fullPage: true,
    },
  ],
};
