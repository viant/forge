import {
  buildImportedListEntryFixturePreparationSteps,
  buildSelectedListEntryExportButtonStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildImportedListEntryFixturePreparationSteps({
      fixtureModulePath: "/src/reporting/fixtures/capacityAudienceLandscapeFixtureState.js",
      fixtureBuilderName: "buildCapacityAudienceLandscapeFixtureState",
      savedRecordFilename: "capacity-audience.saved-report-record.submit-failure.json",
      listResponseFilename: "capacity-audience.list-response.submit-failure.json",
      captureDownloads: true,
    }),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'savedPayload', format: 'pdf', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_audience_segment_index_q3', title: 'Capacity Audience Segment Index Q3' }, error: 'Preview export submit was rejected for Capacity Audience Segment Index Q3.', result: { jobId: 'demo-export-job-submit-failed-audience', status: 'failed', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_audience_segment_index_q3', format: 'pdf', scope: 'savedPayload', error: 'Preview export submit was rejected for Capacity Audience Segment Index Q3.' } }]); return true; })()",
    },
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Capacity Audience Segment Index Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment') && text.includes('demo-export-job-submit-failed-audience') && text.includes('failed') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-list-report-documents-submit-failure.png",
      fullPage: true,
    },
  ],
};
