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
      savedRecordFilename: "capacity-audience.saved-report-record.landscape.json",
      listResponseFilename: "capacity-audience.list-response.landscape.json",
      captureDownloads: true,
    }),
    {
      type: "assertDomNotContains",
      text: "No local payload backing",
    },
    buildSelectedListEntryExportButtonStep({ mode: "inspect" }),
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Selected list entry export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; return text.includes('savedPayload') && text.includes('PDF') && text.includes('reportPrint') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportExportRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"definitionRef\": \"harmonizer://feature/user.segment.index\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"definitionRef\": \"harmonizer://feature/user.segment\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportPrint\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"width\": 792",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"height\": 612",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Selected list entry export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Selected list entry export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Download export request')); if (!button) { throw new Error('Download export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Audience Segment Index Q3-savedPayload-pdf-export-request.json' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true && window.__artifactDownloadCapture.mimeType.includes('application/json') && window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportExportRequest\"') && window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportPrint\"') && window.__artifactDownloadCapture.payload.includes('\"width\": 792') && window.__artifactDownloadCapture.payload.includes('\"height\": 612')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-list-report-documents-export-request.png",
      fullPage: true,
    },
  ],
};
