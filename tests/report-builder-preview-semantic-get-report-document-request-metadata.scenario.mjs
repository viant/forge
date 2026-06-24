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
      value: "Get request metadata visibility.",
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
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Saved report payload: Executive Snapshot'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Show API artifacts",
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('input[aria-label=\"Document version\"]'))()",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "11",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 11.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "demoReportBuilder",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Get ReportDocument request: Executive Snapshot'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions') && text.includes('Household Uniques'); })()",
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
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get request metadata visibility.",
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
      type: "waitForDomContains",
      text: "\"reportId\": \"demoReportBuilder\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download get request",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Executive Snapshot-get-report-document-request.json'",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentRequest\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"demoReportBuilder\"')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-get-report-document-request-metadata.png",
      fullPage: true,
    },
  ],
};
