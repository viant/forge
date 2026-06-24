import baseScenario from "./report-builder-preview-semantic-import-published-snapshot-export-request.scenario.mjs";
import { buildSectionButtonClickStep } from "./report-builder-preview-scenario-builders.mjs";

const baseSteps = (Array.isArray(baseScenario?.steps) ? baseScenario.steps : []).filter(
  (step) => step?.type !== "screenshot",
);

export default {
  ...baseScenario,
  steps: [
    ...baseSteps,
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'importedRequest', format: 'pdf', artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3', title: 'Capacity Trend Q3 Published Snapshot' }, error: 'Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.', result: { jobId: 'demo-export-job-submit-failed-import-published-snapshot', status: 'failed', artifactRef: 'reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3', format: 'pdf', scope: 'importedRequest', error: 'Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.' } }]); return true; })()",
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Active saved artifact",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "active saved artifact section not found",
      missingButtonMessage: "published-snapshot export button not found",
    }),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Trend Q3 Published Snapshot.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('publishedSnapshot') && text.includes('reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques') && text.includes('demo-export-job-submit-failed-import-published-snapshot') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-published-snapshot-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
