import {
  buildChartQueryBaselineResetSteps,
  buildChartQueryBaselineStableWaitStep,
  buildClearDetailTargetBehaviorsSteps,
  buildDetailTargetBehaviorInjectionSteps,
  buildPreviewBootstrapSteps,
  buildRuntimeDetailTargetFailureSteps,
  buildRuntimeResolvedDetailTargetWaitSteps,
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
      reportId: "capacityInventoryTopChannelsQ3",
      responseTitle: "Get ReportDocument response: Capacity Inventory Top Channels Q3",
    }),
    ...buildDetailTargetBehaviorInjectionSteps({
      targetRef: "target://example/performance/channel-detail",
    }),
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
      text: "Reopened ReportDocument Capacity Inventory Top Channels Q3 for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
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
    ...buildChartQueryBaselineResetSteps({
      baselineKey: "__reopenedInventoryChartDetailRecoveryExportBaseline",
    }),
    ...buildRuntimeDetailTargetFailureSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show channel details",
      failureTargetRef: "target://example/performance/channel-detail",
    }),
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedInventoryChartDetailRecoveryExportBaseline",
    }),
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "eval",
      expression: "(() => { const rows = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel tbody tr')); const row = rows.find((entry) => ((entry.innerText || entry.textContent || '')).includes('CTV')); if (!row) { throw new Error('Runtime preview row for CTV not found.'); } const button = Array.from(row.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show channel details')); if (!button) { throw new Error('Show channel details action for CTV not found.'); } button.click(); return true; })()",
    },
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/channel-detail",
        "CTV",
      ],
      forbiddenTexts: [
        "Detail target resolution failed.",
      ],
      requireHostIntent: true,
    }),
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedInventoryChartDetailRecoveryExportBaseline",
    }),
    ...buildReopenedExportInspectionSteps({
      reopenedNoticeText: "Reopened ReportDocument: Capacity Inventory Top Channels Q3",
      expectedFilename: "Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json",
      exportTitle: "Capacity Inventory Top Channels Q3",
      bookmarkId: "bookmark.primaryChart",
      extraPayloadText: "Inventory · Top Channels",
    }),
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedInventoryChartDetailRecoveryExportBaseline",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-chart-detail-error-recovery-export-request.png",
      fullPage: true,
    },
  ],
};
