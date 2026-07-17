import {
  buildChartQueryBaselineResetSteps,
  buildChartQueryBaselineStableWaitStep,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
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
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      responseTitle: "Get ReportDocument response: Capacity Locations Top Markets Q3",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !Array.isArray(preview.fetchEventHistory)) { return false; } const starts = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts > 0 && starts === endings; })()",
      timeoutMs: 60000,
    },
    ...buildChartQueryBaselineResetSteps({
      baselineKey: "__reopenedLocationChartToggleCacheBaseline",
      missingResetMessage: "Preview resetCounters API not available.",
    }),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__result-header .forge-report-builder__view-toggle button",
      text: "table",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('.forge-report-builder__table-wrap'))()",
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.binding?.mode === 'semantic'",
      timeoutMs: 60000,
    },
    buildChartQueryBaselineStableWaitStep({
      baselineKey: "__reopenedLocationChartToggleCacheBaseline",
    }),
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__chart-wrap .recharts-wrapper').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-toggle-cache.png",
      fullPage: true,
    },
  ],
};
