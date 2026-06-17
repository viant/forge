import {
  buildPreviewBootstrapSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
  buildReopenedExportInspectionSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    ...buildSavedPayloadPreparationSteps({ documentVersion: "11", draftTriggerText: "Reach Rate" }),
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "forecastingLocationsTopMarketsQ3",
      responseTitle: "Get ReportDocument response: Forecasting Locations Top Markets Q3",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && typeof preview.replaceDetailTargetBehaviors === 'function' && preview.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://steward/performance/market-detail' }, error: 'Detail target resolution failed.' }]) === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec == null",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Reopen in builder",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Forecasting Locations Top Markets Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Forecast Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !Array.isArray(preview.fetchEventHistory)) { return false; } const starts = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts > 0 && starts === endings; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.resetCounters !== 'function') { throw new Error('resetCounters API not available.'); } preview.resetCounters(); preview.__reopenedLocationChartDetailRecoveryExportBaseline = { startCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, successCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length }; return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const baseline = window.__REPORT_BUILDER_PREVIEW__?.__reopenedLocationChartDetailRecoveryExportBaseline; return !!baseline && baseline.startCount === 0 && baseline.successCount === 0 && baseline.requestCount === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show market details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') == null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const tablePanel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel'); const text = panel?.innerText || panel?.textContent || ''; return !!tablePanel && text.includes('Failed to resolve detail target target://steward/performance/market-detail. Detail target resolution failed.') && !text.includes('Resolved detail target'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedLocationChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && typeof preview.clearDetailTargetBehaviors === 'function' && preview.clearDetailTargetBehaviors() === 0 && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show market details",
      index: 1,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Resolved detail target') && text.includes('target://steward/performance/market-detail') && text.includes('country') && text.includes('CA') && !text.includes('Detail target resolution failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') != null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedLocationChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    ...buildReopenedExportInspectionSteps({
      reopenedNoticeText: "Reopened ReportDocument: Forecasting Locations Top Markets Q3",
      expectedFilename: "Forecasting Locations Top Markets Q3-savedPayload-pdf-export-request.json",
      exportTitle: "Forecasting Locations Top Markets Q3",
      bookmarkId: "bookmark.primaryChart",
      extraPayloadText: "Locations · Top Markets",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedLocationChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-detail-error-recovery-export-request.png",
      fullPage: true,
    },
  ],
};
