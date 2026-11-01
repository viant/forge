import { readFileSync } from "node:fs";
import {
  buildPreviewBootstrapSteps,
  buildReopenedExportInspectionSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const reopenedExportInspectionSteps = buildReopenedExportInspectionSteps({
  reopenedNoticeText: "Reopened ReportDocument: Capacity Inventory Top Channels Q3",
  expectedFilename: "Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json",
  exportTitle: "Capacity Inventory Top Channels Q3",
  bookmarkId: "bookmark.primaryChart",
  extraPayloadText: "Inventory · Top Channels",
});

const exportRequestFixture = JSON.parse(readFileSync(
  new URL("../src/reporting/fixtures/capacity-inventory-export-request-fixture.v1.json", import.meta.url),
  "utf8",
));

const expectedReportPrintSignature = {
  pageGeometry: exportRequestFixture.reportPrint.pageGeometry,
  pages: (exportRequestFixture.reportPrint.pages || []).map((page) => ({
    number: page.number,
    elements: (page.elements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    headerElements: (page.headerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    footerElements: (page.footerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
  })),
  diagnostics: exportRequestFixture.reportPrint.diagnostics || [],
};

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    {
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 15000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityInventoryTopChannelsQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Selected entry: Capacity Inventory Top Channels Q3') && text.includes('Template: Capacity Inventory Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityInventoryTopChannelsQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Inventory Top Channels Q3",
      reportId: "capacityInventoryTopChannelsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentTemplateId === 'capacity_inventory_brief' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentTemplateLabel === 'Capacity Inventory Brief' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Inventory · Top Channels' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.type === 'horizontal_bar' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.xField === 'channelV2' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.yFields) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().chartSpec.yFields.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().chartSpec.yFields[0] === 'avails' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    reopenedExportInspectionSteps[0],
    reopenedExportInspectionSteps[1],
    reopenedExportInspectionSteps[2],
    {
      type: "waitForEval",
      expression: `(() => { const summary = Array.from(document.querySelectorAll('[aria-label="Reopened export request summary"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { return false; } try { const parsed = JSON.parse(pre.textContent || '{}'); const reportPrint = parsed?.reportPrint; if (!reportPrint) { return false; } const signature = { pageGeometry: reportPrint.pageGeometry || null, pages: (Array.isArray(reportPrint.pages) ? reportPrint.pages : []).map((page) => ({ number: page?.number ?? null, elements: (Array.isArray(page?.elements) ? page.elements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), headerElements: (Array.isArray(page?.headerElements) ? page.headerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), footerElements: (Array.isArray(page?.footerElements) ? page.footerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })) })), diagnostics: Array.isArray(reportPrint.diagnostics) ? reportPrint.diagnostics : [] }; return JSON.stringify(signature) === ${JSON.stringify(JSON.stringify(expectedReportPrintSignature))}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
    reopenedExportInspectionSteps[3],
    reopenedExportInspectionSteps[4],
    reopenedExportInspectionSteps[5],
    {
      type: "waitForEval",
      expression: `(() => { if (!window.__artifactDownloadCapture?.payloadReady) { return false; } const raw = window.__artifactDownloadCapture?.payload || ''; if (!raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint; const signature = { pageGeometry: reportPrint?.pageGeometry || null, pages: (Array.isArray(reportPrint?.pages) ? reportPrint.pages : []).map((page) => ({ number: page?.number ?? null, elements: (Array.isArray(page?.elements) ? page.elements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), headerElements: (Array.isArray(page?.headerElements) ? page.headerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), footerElements: (Array.isArray(page?.footerElements) ? page.footerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })) })), diagnostics: Array.isArray(reportPrint?.diagnostics) ? reportPrint.diagnostics : [] }; return JSON.stringify(signature) === ${JSON.stringify(JSON.stringify(expectedReportPrintSignature))}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-capacity-inventory-template-export-geometry.png",
      fullPage: true,
    },
  ],
};
