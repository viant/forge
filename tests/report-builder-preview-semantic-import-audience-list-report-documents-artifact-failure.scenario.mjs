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
      savedRecordFilename: "capacity-audience.saved-report-record.artifact-failure.json",
      listResponseFilename: "capacity-audience.list-response.artifact-failure.json",
      captureDownloads: true,
    }),
    buildSelectedListEntryExportButtonStep(),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Capacity Audience Segment Index Q3.",
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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const artifactId = preview?.lastExportRequest?.artifactId; if (!artifactId) { throw new Error('last export artifact id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'artifact', artifactId }, error: 'Could not load the preview export artifact for Capacity Audience Segment Index Q3.' }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForDomContains",
      text: "Could not load the preview export artifact for Capacity Audience Segment Index Q3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-1') && text.includes('succeeded') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-list-report-documents-artifact-failure.png",
      fullPage: true,
    },
  ],
};
