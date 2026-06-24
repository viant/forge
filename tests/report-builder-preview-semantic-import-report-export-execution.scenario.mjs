import baseScenario from "./report-builder-preview-semantic-import-report-export-request.scenario.mjs";
import { buildSectionButtonClickStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

const captureDownloadPatchStep = {
  type: "eval",
  expression: "(() => { window.__artifactDownloadCapture = { filename: '', payload: '', mimeType: '', payloadReady: false }; if (window.__artifactDownloadCapturePatched) { return true; } const originalCreate = URL.createObjectURL.bind(URL); URL.createObjectURL = (blob) => { window.__artifactDownloadCapture.mimeType = blob.type || ''; window.__artifactDownloadCapture.payload = ''; window.__artifactDownloadCapture.payloadReady = false; blob.text().then((text) => { window.__artifactDownloadCapture.payload = text; window.__artifactDownloadCapture.payloadReady = true; }); return originalCreate(blob); }; const originalClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function() { window.__artifactDownloadCapture.filename = this.download || ''; return originalClick.call(this); }; window.__artifactDownloadCapturePatched = true; return true; })()",
};

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    captureDownloadPatchStep,
    buildSectionButtonClickStep({
      sectionIncludes: "Imported export request:",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "imported export request notice not found",
      missingButtonMessage: "imported export submit button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Trend Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('queued') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is queued.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is succeeded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-1') && text.includes('succeeded'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Trend Q3.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-demo Capacity Trend Q3')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-export-execution.png",
      fullPage: true,
    },
  ],
};
