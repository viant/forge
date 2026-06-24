import baseScenario from "./report-builder-preview-semantic-list-entry-saved-view-export-request.scenario.mjs";
import { buildSelectedListEntryExportButtonStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'listEntry', format: 'pdf', artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3', title: 'Capacity Trend Q3 Saved View' }, error: 'Preview export submit was rejected for Capacity Trend Q3 Saved View.', result: { jobId: 'demo-export-job-submit-failed-list-saved-view', status: 'failed', artifactRef: 'reportBuilder.savedView://saved_view_capacityTrendQ3', format: 'pdf', scope: 'listEntry', error: 'Preview export submit was rejected for Capacity Trend Q3 Saved View.' } }]); return true; })()",
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Trend Q3 Saved View.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('imported saved-view') && text.includes('saved-view artifact') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques') && text.includes('demo-export-job-submit-failed-list-saved-view') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-saved-view-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
