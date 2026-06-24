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
      savedRecordFilename: "capacity-audience.saved-report-record.failure.json",
      listResponseFilename: "capacity-audience.list-response.failure.json",
      captureDownloads: false,
    }),
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Audience Segment Index Q3.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const jobId = preview?.lastExportRequest?.jobId; if (!jobId) { throw new Error('last export job id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'status', jobId }, result: { jobId, status: 'failed', artifactId: '', artifactRef: 'reportBuilder.savedReportPayload://rbreport_capacity_audience_segment_index_q3', format: 'pdf', error: 'Renderer rejected reportPrint for audience export.', diagnostics: [{ code: 'export.renderUnsupported', severity: 'error', path: '$.reportPrint.pages[0]', message: 'Unsupported chart primitive in current renderer.', suggestedFix: 'Use a print-safe chart preset.' }] } }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Renderer rejected reportPrint for audience export.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Unsupported chart primitive in current renderer.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Use a print-safe chart preset.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-list-report-documents-export-failure.png",
      fullPage: true,
    },
  ],
};
