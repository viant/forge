import baseScenario from "./report-builder-preview-semantic-import-report-fill-attach-report-spec-export-request.scenario.mjs";
import { buildAriaSectionButtonClickStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'imported', format: 'pdf', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_trend_q3', title: 'Capacity Trend Q3' }, error: 'Preview export submit was rejected for Capacity Trend Q3.', result: { jobId: 'demo-export-job-submit-failed-fill-attach', status: 'failed', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_trend_q3', format: 'pdf', scope: 'imported', error: 'Preview export submit was rejected for Capacity Trend Q3.' } }]); return true; })()",
    },
    buildAriaSectionButtonClickStep({
      ariaLabel: "Imported runtime preview",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "imported runtime section not found",
      missingButtonMessage: "imported pipeline export button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Trend Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('ATTACHED REPORTFILL') && text.includes('demo-export-job-submit-failed-fill-attach') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
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
      file: "report-builder-preview-semantic-import-report-fill-attach-report-spec-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
