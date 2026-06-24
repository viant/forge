import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Reach Rate",
      index: 0,
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
      text: "Saved exploration artifact: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.savedReportPayload",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Saved report payload summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download report payload",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Report Builder Demo-saved-report-payload.json'",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportBuilder.savedReportPayload\"')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect report payload",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Saved report payload summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "reportBuilder.savedReportPayload",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"payloadId\": \"rbreport_",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportDocument\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportSpec\": {",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide report payload",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Saved report payload summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "reportBuilder.savedReportPayload",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-saved-report-payload.png",
      fullPage: true,
    },
  ],
};
