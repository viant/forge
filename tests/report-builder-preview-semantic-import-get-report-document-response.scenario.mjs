import {
  buildSeededSavedPayloadArtifactImportSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityTrendQ3",
      artifactExpression: "{ version: 1, kind: 'getReportDocumentResponse', reportRef: { reportId: payload.reportDocument.id }, documentVersion: 6, savedAt: payload.savedAt, document: payload.reportDocument, compileState: payload.compileState, source: { kind: payload.kind, payloadId: payload.payloadId, sourceArtifactId: payload.sourceArtifactId }, reportSpec: payload.reportSpec }",
      filename: "capacity-trend.get-response.json",
      importedNoticeText: "Imported getReportDocument response Capacity Trend Q3.",
      captureDownloads: true,
    }),
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "getReportDocumentResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download get response",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Capacity Trend Q3-getReportDocumentResponse.json'",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentResponse\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"capacityTrendQ3\"')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForDomContains",
      text: "getReportDocumentResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide get response",
    },
    {
      type: "assertDomNotContains",
      text: "getReportDocumentResponse",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForDomContains",
      text: "getReportDocumentResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Capacity Trend Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Governed reporting model for the report builder preview.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Daily delivery grain",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Approved buying channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Certified available inventory",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = (panel?.innerText || panel?.textContent || ''); return text.includes('SELECTED MEASURES (1)') && text.includes('CERTIFIED') && text.includes('REVIEWED'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-get-report-document-response.png",
      fullPage: true,
    },
  ],
};
