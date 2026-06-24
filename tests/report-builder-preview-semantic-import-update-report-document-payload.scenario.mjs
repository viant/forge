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
      artifactExpression: "{ version: 1, kind: 'updateReportDocumentPayload', reportRef: { reportId: 'capacityTrendQ3' }, title: 'Capacity Trend Q3', expectedVersion: 7, source: { payloadId: 'rbreport_capacity_q3_channel_trend', sourceArtifactId: 'capacity_q3_channel_trend' }, document: { title: 'Capacity Trend Q3', subtitle: 'Imported update payload', description: 'Inspect-only local update payload import.' }, reportSpec: { version: 1, kind: 'reportSpec', binding: { mode: 'semantic', modelRef: 'model://example/performance/delivery@v1', entity: 'line_delivery' }, semanticSummary: { kind: 'semantic', modelRef: 'model://example/performance/delivery@v1', modelLabel: 'Imported Ad Delivery', entity: 'line_delivery', entityLabel: 'Imported Line Delivery', selectedDimensions: [ { id: 'event_date', rawId: 'eventDate', label: 'Imported Delivery Date', category: 'Time' } ], selectedMeasures: [ { id: 'available_impressions', rawId: 'avails', label: 'Imported Available Impressions', category: 'Metrics' } ], selectedParameters: [ { id: 'reporting_window', rawId: 'dateRange', label: 'Imported Reporting Window', category: 'Scope' } ] }, scope: { params: [ { id: 'dateRange', label: 'Imported Reporting Window', description: 'Imported scope from reportSpec.' } ] } }, compileState: { status: 'clean', blockCount: 2, datasetCount: 1 } }",
      filename: "capacity-trend.update-report-document.json",
      importedNoticeText: "Imported updateReportDocument payload Capacity Trend Q3.",
    }),
    {
      type: "waitForDomContains",
      text: "Update ReportDocument payload: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Imported Ad Delivery') && text.includes('Entity Imported Line Delivery') && text.includes('Imported Available Impressions') && text.includes('Imported Reporting Window'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "updateReportDocumentPayload",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect update payload",
    },
    {
      type: "waitForDomContains",
      text: "updateReportDocumentPayload",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Imported update payload",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"modelLabel\": \"Imported Ad Delivery\"",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-update-report-document-payload.png",
      fullPage: true,
    },
  ],
};
