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

const expectedReportPrintSignature = {
  pageGeometry: {
    width: 792,
    height: 612,
    marginTop: 36,
    marginRight: 36,
    marginBottom: 36,
    marginLeft: 36,
    headerHeight: 36,
    footerHeight: 24,
  },
  pages: [
    {
      number: 1,
      elements: [
        { id: "scopeFilters__title_0", kind: "text", box: { x: 36, y: 84, width: 720, height: 20 }, text: "Scope" },
        { id: "scopeFilters__line_0", kind: "text", box: { x: 36, y: 108, width: 720, height: 16 }, text: "dateRange: 2026-05-01 to 2026-05-04" },
        { id: "scopeFilters__line_1", kind: "text", box: { x: 36, y: 124, width: 720, height: 16 }, text: "channelsFilter:" },
        { id: "primaryTable__title_0", kind: "text", box: { x: 36, y: 156, width: 720, height: 20 }, text: "Table" },
        { id: "primaryTable__header_bg__page_1", kind: "rect", box: { x: 36, y: 180, width: 720, height: 24 }, text: null },
        { id: "primaryTable__header__channelV2__page_1", kind: "text", box: { x: 42, y: 184, width: 348, height: 16 }, text: "Channel" },
        { id: "primaryTable__header__avails__page_1", kind: "text", box: { x: 402, y: 184, width: 348, height: 16 }, text: "Available Impressions" },
        { id: "primaryTable__row_rule_0", kind: "line", box: { x: 36, y: 228, width: 720, height: 0 }, text: null },
        { id: "primaryTable__row_1__channelV2__text", kind: "tableCellText", box: { x: 42, y: 208, width: 348, height: 16 }, text: "Display" },
        { id: "primaryTable__row_1__avails__text", kind: "tableCellText", box: { x: 402, y: 208, width: 348, height: 16 }, text: "158400" },
        { id: "primaryTable__row_rule_1", kind: "line", box: { x: 36, y: 252, width: 720, height: 0 }, text: null },
        { id: "primaryTable__row_2__channelV2__text", kind: "tableCellText", box: { x: 42, y: 232, width: 348, height: 16 }, text: "CTV" },
        { id: "primaryTable__row_2__avails__text", kind: "tableCellText", box: { x: 402, y: 232, width: 348, height: 16 }, text: "138200" },
        { id: "primaryChart__title_0", kind: "text", box: { x: 36, y: 268, width: 720, height: 20 }, text: "Inventory · Top Channels" },
        { id: "primaryChart__svg_page_1", kind: "svg", box: { x: 36, y: 292, width: 720, height: 164 }, text: null },
        { id: "narrativeIntro__title_0", kind: "text", box: { x: 36, y: 472, width: 348, height: 20 }, text: "Inventory Outlook" },
        { id: "narrativeIntro__line_0", kind: "text", box: { x: 36, y: 496, width: 348, height: 16 }, text: "Inventory Outlook" },
        { id: "narrativeIntro__line_1", kind: "text", box: { x: 36, y: 512, width: 348, height: 16 }, text: "Start at Channel, then drill deeper through" },
        { id: "narrativeIntro__line_2", kind: "text", box: { x: 36, y: 528, width: 348, height: 16 }, text: "Publisher and Site Type." },
        { id: "headlineKpi__title_0", kind: "text", box: { x: 408, y: 472, width: 348, height: 20 }, text: "Top Channel KPI" },
        { id: "headlineKpi__value_0", kind: "text", box: { x: 408, y: 496, width: 348, height: 24 }, text: "Avails: 158400" },
        { id: "headlineKpi__detail_0", kind: "text", box: { x: 408, y: 520, width: 348, height: 16 }, text: "Channel: Display" },
      ],
      headerElements: [
        { id: "page_1__header_title", kind: "text", box: { x: 36, y: 36, width: 720, height: 28 }, text: "Capacity Inventory Top Channels Q3" },
        { id: "page_1__header_rule", kind: "line", box: { x: 36, y: 70, width: 720, height: 0 }, text: null },
      ],
      footerElements: [
        { id: "page_1__footer_rule", kind: "line", box: { x: 36, y: 554, width: 720, height: 0 }, text: null },
        { id: "page_1__footer_page_number", kind: "text", box: { x: 36, y: 558, width: 720, height: 16 }, text: "Page 1" },
      ],
    },
    {
      number: 2,
      elements: [
        { id: "headlineKpi__detail_1", kind: "text", box: { x: 408, y: 84, width: 348, height: 16 }, text: "Highlights the leading channel row before drilling" },
        { id: "headlineKpi__detail_2", kind: "text", box: { x: 408, y: 100, width: 348, height: 16 }, text: "deeper." },
      ],
      headerElements: [
        { id: "page_2__header_title", kind: "text", box: { x: 36, y: 36, width: 720, height: 28 }, text: "Capacity Inventory Top Channels Q3" },
        { id: "page_2__header_rule", kind: "line", box: { x: 36, y: 70, width: 720, height: 0 }, text: null },
      ],
      footerElements: [
        { id: "page_2__footer_rule", kind: "line", box: { x: 36, y: 554, width: 720, height: 0 }, text: null },
        { id: "page_2__footer_page_number", kind: "text", box: { x: 36, y: 558, width: 720, height: 16 }, text: "Page 2" },
      ],
    },
  ],
  diagnostics: [],
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
