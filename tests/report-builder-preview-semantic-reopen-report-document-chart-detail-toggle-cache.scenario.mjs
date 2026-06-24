import {
  buildChartQueryBaselineResetSteps,
  buildChartQueryBaselineStableWaitStep,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartActionSelectionSteps,
  buildRuntimeResolvedDetailTargetWaitSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityTrendQ3",
      responseTitle: "Get ReportDocument response: Capacity Trend Q3",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !Array.isArray(preview.fetchEventHistory)) { return false; } const starts = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts > 0 && starts === endings; })()",
      timeoutMs: 60000,
    },
    ...buildChartQueryBaselineResetSteps({
      baselineKey: "__reopenedChartDetailToggleCacheBaseline",
      missingResetMessage: "Preview resetCounters API not available.",
    }),
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-chart-legend-action",
      text: "Display",
      index: 0,
    },
    ...buildRuntimeChartActionSelectionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show channel details",
      selectedValueTexts: [
        "Selected value:",
        "Display",
      ],
      clickMarkIndex: 0,
    }),
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/channel-detail",
        "channel",
        "Display",
      ],
      requireHostIntent: true,
    }),
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedChartDetailToggleCacheBaseline",
    }),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__result-header .forge-report-builder__view-toggle button",
      text: "table",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table'",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__result-header .forge-report-builder__view-toggle button",
      text: "chart",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedChartDetailToggleCacheBaseline",
    }),
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/channel-detail",
        "channel",
        "Display",
      ],
      requireHostIntent: true,
    }),
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-detail-toggle-cache.png",
      fullPage: true,
    },
  ],
};
