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
      artifactExpression: "{ version: 1, kind: 'getReportDocumentRequest', reportRef: { reportId: 'capacityTrendQ3' } }",
      filename: "capacity-trend.get-report-document-request.json",
      importedNoticeText: "Imported getReportDocument request capacityTrendQ3.",
      captureDownloads: true,
    }),
    {
      type: "waitForDomContains",
      text: "Get ReportDocument request: capacityTrendQ3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "getReportDocumentRequest",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download get request",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'capacityTrendQ3-get-report-document-request.json'",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentRequest\"') && window.__artifactDownloadCapture.payload.includes('\"reportId\": \"capacityTrendQ3\"')",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get request",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "getReportDocumentRequest",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityTrendQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide get request",
    },
    {
      type: "assertDomNotContains",
      text: "getReportDocumentRequest",
    },
    {
      type: "waitForEval",
      expression: "!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-get-report-document-request.png",
      fullPage: true,
    },
  ],
};
