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
      reportId: "forecastingInventoryTopChannelsQ3",
      responseTitle: "Get ReportDocument response: Forecasting Inventory Top Channels Q3",
    }),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceDetailTargetBehaviors !== 'function') { throw new Error('replaceDetailTargetBehaviors API not available.'); } return preview.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://steward/performance/channel-detail' }, error: 'Detail target resolution failed.' }]); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return preview.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null }); })()",
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
      text: "Reopened ReportDocument Forecasting Inventory Top Channels Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Forecast Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Inventory · Top Channels'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !Array.isArray(preview.fetchEventHistory)) { return false; } const starts = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts > 0 && starts === endings; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.resetCounters !== 'function') { throw new Error('resetCounters API not available.'); } preview.resetCounters(); preview.__reopenedInventoryChartDetailRecoveryExportBaseline = { startCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, successCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length }; return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const baseline = window.__REPORT_BUILDER_PREVIEW__?.__reopenedInventoryChartDetailRecoveryExportBaseline; return !!baseline && baseline.startCount === 0 && baseline.successCount === 0 && baseline.requestCount === 0; })()",
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
      text: "Show channel details",
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
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const tablePanel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel'); const text = panel?.innerText || ''; return !!tablePanel && text.includes('Failed to resolve detail target target://steward/performance/channel-detail. Detail target resolution failed.') && !text.includes('Resolved detail target'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedInventoryChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.clearDetailTargetBehaviors !== 'function') { throw new Error('clearDetailTargetBehaviors API not available.'); } preview.clearDetailTargetBehaviors(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.detailTargetBehaviors) && preview.detailTargetBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const rows = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel tbody tr')); const row = rows.find((entry) => ((entry.innerText || entry.textContent || '')).includes('CTV')); if (!row) { throw new Error('Runtime preview row for CTV not found.'); } const button = Array.from(row.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show channel details')); if (!button) { throw new Error('Show channel details action for CTV not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Resolved detail target') && text.includes('target://steward/performance/channel-detail') && text.includes('CTV') && !text.includes('Detail target resolution failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') != null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedInventoryChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    ...buildReopenedExportInspectionSteps({
      reopenedNoticeText: "Reopened ReportDocument: Forecasting Inventory Top Channels Q3",
      expectedFilename: "Forecasting Inventory Top Channels Q3-savedPayload-pdf-export-request.json",
      exportTitle: "Forecasting Inventory Top Channels Q3",
      bookmarkId: "bookmark.primaryChart",
      extraPayloadText: "Inventory · Top Channels",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__reopenedInventoryChartDetailRecoveryExportBaseline; if (!preview || !baseline) { return false; } const startCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount && successCount === baseline.successCount && requestCount === baseline.requestCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-chart-detail-error-recovery-export-request.png",
      fullPage: true,
    },
  ],
};
