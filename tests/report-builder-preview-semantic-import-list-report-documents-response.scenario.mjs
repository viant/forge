import {
  buildInlineArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildInlineArtifactImportSteps({
      artifactExpression: "{ version: 1, kind: 'listReportDocumentsResponse', cursor: 'imported-cursor', hasMore: true, entries: [ { reportRef: { reportId: 'importedOnlyTrendQ3' }, documentVersion: 6, title: 'Imported Only Trend Q3', subtitle: 'Imported list entry', description: 'Local list import without a backing saved payload.', source: { kind: 'reportBuilder.savedReportPayload', payloadId: 'rbreport_imported_only_trend_q3', sourceArtifactId: 'imported_only_trend_q3' }, compileState: { status: 'clean' }, binding: { mode: 'semantic', modelRef: 'model://example/performance/delivery@v1', entity: 'line_delivery' }, semanticSummary: { kind: 'semantic', modelRef: 'model://example/performance/delivery@v1', modelLabel: 'Imported Ad Delivery', entity: 'line_delivery', entityLabel: 'Imported Line Delivery', selectedDimensions: [ { id: 'event_date', rawId: 'eventDate', label: 'Imported Delivery Date', category: 'Time' } ], selectedMeasures: [ { id: 'available_impressions', rawId: 'avails', label: 'Imported Available Impressions', category: 'Metrics', governance: { ownerRef: 'team://example/performance' } } ], selectedParameters: [ { id: 'reporting_window', rawId: 'dateRange', label: 'Imported Reporting Window', category: 'Scope' } ] }, scope: { dataSourceRef: 'demoReportSource', params: [ { id: 'dateRange', kind: 'dateRange', label: 'Imported Reporting Window', description: 'Imported list scope metadata.' } ] } } ] }",
      filename: "imported-only.list-response.json",
      importedNoticeText: "Imported listReportDocuments response with 1 entry.",
      captureDownloads: true,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const notice = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Imported listReportDocuments response with 1 entry.')); const text = notice?.innerText || notice?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Imported Ad Delivery') && text.includes('Entity Imported Line Delivery') && text.includes('Imported Available Impressions') && text.includes('Owner team://example/performance') && text.includes('Imported Reporting Window'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 1 entries",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Imported Only Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Imported Ad Delivery') && text.includes('Entity Imported Line Delivery') && text.includes('Imported Available Impressions') && text.includes('Owner team://example/performance') && text.includes('Imported Reporting Window'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download list response",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Imported Only Trend Q3-listReportDocumentsResponse.json'",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"listReportDocumentsResponse\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"importedOnlyTrendQ3\"')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForDomContains",
      text: "listReportDocumentsResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide list response",
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForDomContains",
      text: "listReportDocumentsResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "Prepared getReportDocument request for importedOnlyTrendQ3.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Get ReportDocument request: Imported Only Trend Q3') && text.includes('Semantic Binding') && text.includes('Model Imported Ad Delivery') && text.includes('Entity Imported Line Delivery') && text.includes('Imported Reporting Window'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Only entries backed by a local ReportDocument payload can be expanded locally.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Check reopen compatibility",
    },
    {
      type: "waitForDomContains",
      text: "Imported list entry",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-list-report-documents-response.png",
      fullPage: true,
    },
  ],
};
