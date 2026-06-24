import baseScenario from "./report-builder-preview-semantic-list-entry-published-snapshot-export-request.scenario.mjs";
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'listEntry', format: 'pdf', artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3', title: 'Capacity Trend Q3 Published Snapshot' }, error: 'Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.', result: { jobId: 'demo-export-job-submit-failed-list-published-snapshot', status: 'failed', artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3', format: 'pdf', scope: 'listEntry', error: 'Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.' } }]); return true; })()",
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('imported published-snapshot') && text.includes('published-snapshot artifact') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques') && text.includes('demo-export-job-submit-failed-list-published-snapshot') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-list-entry-published-snapshot-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
