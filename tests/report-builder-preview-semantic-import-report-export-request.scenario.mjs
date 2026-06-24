import {
  buildPreviewBootstrapSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: false }),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const input = document.querySelector('input[aria-label=\"Import report file\"]'); if (!preview || typeof preview.getSeededSavedReportPayloads !== 'function' || !input) { throw new Error('import api unavailable'); } const payloads = preview.getSeededSavedReportPayloads(); const target = payloads.find((entry) => (entry?.savedReportPayload?.reportDocument?.id || entry?.reportId) === 'capacityTrendQ3'); const record = target || payloads[0]; const exportRequest = record?.exportRequest; const title = String(exportRequest?.source?.title || exportRequest?.reportSpec?.title || 'Report'); if (!exportRequest) { throw new Error('seeded export request not found'); } window.__IMPORTED_EXPORT_REQUEST_TITLE__ = title; const file = new File([JSON.stringify(exportRequest, null, 2)], 'capacity-trend.export-request.json', { type: 'application/json' }); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const title = window.__IMPORTED_EXPORT_REQUEST_TITLE__ || 'Report'; return document.body.innerText.includes(`Imported report export request ${title}. Review or export is ready.`); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Imported export request:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Source: savedPayload • Format: PDF",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const section = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Imported export request:')); const text = section?.innerText || section?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Imported export request:",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "imported export request notice not found",
      missingButtonMessage: "inspect export button not found",
    }),
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportExportRequest\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected dimensions (2)",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic Binding",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Entity Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Delivery Date",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-report-export-request.png",
      fullPage: true,
    },
  ],
};
