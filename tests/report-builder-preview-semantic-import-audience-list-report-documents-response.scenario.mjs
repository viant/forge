import {
  buildImportedListEntryFixturePreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildImportedListEntryFixturePreparationSteps({
      fixtureModulePath: "/src/reporting/fixtures/capacityAudienceArtifactFixtureState.js",
      fixtureBuilderName: "buildCapacityAudienceArtifactFixtureState",
      savedRecordFilename: "capacity-audience.saved-report-record.json",
      listResponseFilename: "capacity-audience.list-response.json",
      captureDownloads: true,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const notice = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Imported listReportDocuments response with 1 entry.')); const text = notice?.innerText || notice?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Measures Audience Index') && text.includes('Parameters Date Range, Audience Segment') && text.includes('Date Range • Channels • Audience Segment'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "No local payload backing",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Prepared getReportDocument request for capacityAudienceSegmentIndexQ3. Inspect or download it when needed.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"getReportDocumentRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityAudienceSegmentIndexQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download get request",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Audience Segment Index Q3-get-report-document-request.json'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType.includes('application/json')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentRequest\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"capacityAudienceSegmentIndexQ3\"')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Prepared getReportDocument response for capacityAudienceSegmentIndexQ3. Inspect or download it when needed.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Audience Segment Index Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'audienceIndex' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.staticFilters?.audienceSegmentFilter) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().staticFilters.audienceSegmentFilter.includes('Young Adults') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.orderField === 'audienceIndex' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-audience-list-report-documents-response.png",
      fullPage: true,
    },
  ],
};
