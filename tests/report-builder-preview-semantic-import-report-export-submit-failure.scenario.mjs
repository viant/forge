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
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'importedRequest', format: 'pdf', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_trend_q3', title: 'Capacity Trend Q3' }, error: 'Preview export submit was rejected for Capacity Trend Q3.', result: { jobId: 'demo-export-job-submit-failed-import-request', status: 'failed', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_trend_q3', format: 'pdf', scope: 'importedRequest', error: 'Preview export submit was rejected for Capacity Trend Q3.' } }]); return true; })()",
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported export request:",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "imported export request notice not found",
      missingButtonMessage: "imported export submit button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Trend Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('demo-export-job-submit-failed-import-request') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Imported export: Capacity Trend Q3'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
