import {
  buildPreviewBootstrapSteps,
  buildReopenedExportInspectionSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const reopenedExportInspectionSteps = buildReopenedExportInspectionSteps({
  reopenedNoticeText: "Reopened ReportDocument: Capacity Locations Top Markets Q3",
  expectedFilename: "Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json",
  exportTitle: "Capacity Locations Top Markets Q3",
  bookmarkId: "bookmark.primaryChart",
  extraPayloadText: "Locations · Top Markets",
});

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
      value: "capacityLocationsTopMarketsQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Selected entry: Capacity Locations Top Markets Q3') && text.includes('Template: Capacity Location Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityLocationsTopMarketsQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentTemplateId === 'capacity_location_brief' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentTemplateLabel === 'Capacity Location Brief' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets'",
      timeoutMs: 60000,
    },
    reopenedExportInspectionSteps[0],
    reopenedExportInspectionSteps[1],
    reopenedExportInspectionSteps[2],
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Reopened export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { return false; } try { const parsed = JSON.parse(pre.textContent || '{}'); const reportPrint = parsed?.reportPrint; if (!reportPrint) { return false; } const pages = Array.isArray(reportPrint.pages) ? reportPrint.pages : []; const pageOne = pages.find((page) => page?.number === 1); const pageOneElements = Array.isArray(pageOne?.elements) ? pageOne.elements : []; const scope = pageOneElements.find((element) => element?.id === 'scopeFilters__title_0'); const table = pageOneElements.find((element) => element?.id === 'primaryTable__title_0'); const chart = pageOneElements.find((element) => element?.id === 'primaryChart__title_0'); const narrative = pageOneElements.find((element) => element?.id === 'narrativeIntro__title_0'); const kpi = pageOneElements.find((element) => element?.id === 'headlineKpi__title_0'); const diagnostics = Array.isArray(reportPrint?.diagnostics) ? reportPrint.diagnostics : []; return reportPrint.pageGeometry?.width === 792 && reportPrint.pageGeometry?.height === 612 && pages.length === 2 && diagnostics.length === 0 && scope?.box?.x === 36 && scope?.box?.y === 84 && table?.box?.x === 36 && table?.box?.y === 140 && chart?.box?.x === 36 && chart?.box?.y === 252 && narrative?.box?.x === 36 && narrative?.box?.y === 456 && narrative?.box?.width === 348 && kpi?.box?.x === 408 && kpi?.box?.y === 456 && kpi?.box?.width === 348; } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    reopenedExportInspectionSteps[3],
    reopenedExportInspectionSteps[4],
    reopenedExportInspectionSteps[5],
    {
      type: "waitForEval",
      expression: "(() => { if (!window.__artifactDownloadCapture?.payloadReady) { return false; } const raw = window.__artifactDownloadCapture?.payload || ''; if (!raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint; const pages = Array.isArray(reportPrint?.pages) ? reportPrint.pages : []; const pageOne = pages.find((page) => page?.number === 1); const pageOneElements = Array.isArray(pageOne?.elements) ? pageOne.elements : []; const scope = pageOneElements.find((element) => element?.id === 'scopeFilters__title_0'); const table = pageOneElements.find((element) => element?.id === 'primaryTable__title_0'); const chart = pageOneElements.find((element) => element?.id === 'primaryChart__title_0'); const narrative = pageOneElements.find((element) => element?.id === 'narrativeIntro__title_0'); const kpi = pageOneElements.find((element) => element?.id === 'headlineKpi__title_0'); const diagnostics = Array.isArray(reportPrint?.diagnostics) ? reportPrint.diagnostics : []; return reportPrint?.pageGeometry?.width === 792 && reportPrint?.pageGeometry?.height === 612 && pages.length === 2 && diagnostics.length === 0 && scope?.box?.x === 36 && scope?.box?.y === 84 && table?.box?.x === 36 && table?.box?.y === 140 && chart?.box?.x === 36 && chart?.box?.y === 252 && narrative?.box?.x === 36 && narrative?.box?.y === 456 && narrative?.box?.width === 348 && kpi?.box?.x === 408 && kpi?.box?.y === 456 && kpi?.box?.width === 348; } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-capacity-location-template-export-geometry.png",
      fullPage: true,
    },
  ],
};
