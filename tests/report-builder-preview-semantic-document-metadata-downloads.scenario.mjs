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
  ];
}

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
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
      name: "Download create payload",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Executive Snapshot-create-report-document.json'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType.includes('application/json')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"createReportDocumentPayload\"') && window.__artifactDownloadCapture.payload.includes('\"title\": \"Executive Snapshot\"') && window.__artifactDownloadCapture.payload.includes('Weekly Rollup') && window.__artifactDownloadCapture.payload.includes('Authored payload metadata visibility.')",
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
      name: "Download update payload",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Executive Snapshot-update-report-document-v7.json'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"updateReportDocumentPayload\"') && window.__artifactDownloadCapture.payload.includes('\"title\": \"Executive Snapshot\"') && window.__artifactDownloadCapture.payload.includes('Weekly Rollup') && window.__artifactDownloadCapture.payload.includes('Authored payload metadata visibility.')",
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
      type: "clickRole",
      role: "button",
      name: "Download conflict diagnostic",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"updateReportDocumentConflictDiagnostic\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"demoReportBuilder\"') && window.__artifactDownloadCapture.payload.includes('\"title\": \"Executive Snapshot\"') && window.__artifactDownloadCapture.payload.includes('Weekly Rollup') && window.__artifactDownloadCapture.payload.includes('Authored payload metadata visibility.')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Executive Snapshot-update-conflict-v7-current-v9.json'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-document-metadata-downloads.png",
      fullPage: true,
    },
  ],
};
