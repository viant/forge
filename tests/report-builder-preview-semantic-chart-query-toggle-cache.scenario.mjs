import {
  buildPreviewBootstrapSteps,
  buildPreviewFetchBehaviorReplacementStep,
  buildPreviewPatchBuilderStateStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 720,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.resetCounters !== 'function' || typeof preview.patchBuilderState !== 'function') { return false; } preview.resetCounters(); return preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate', 'channelV2'], chartSpec: null, viewMode: 'table', staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } } }); })()",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec == null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('.forge-report-builder__table-wrap'))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.resetCounters !== 'function' || typeof preview.replaceFetchBehaviors !== 'function') { return false; } preview.resetCounters(); preview.__chartToggleCacheBaseline = { startCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: preview.fetchEventHistory.filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: preview.fetchRequestHistory.filter((entry) => entry.type === 'chartQuery').length }; return preview.replaceFetchBehaviors([{ match: { type: 'chartQuery' }, delayMs: 1500 }]) > 0; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const baseline = window.__REPORT_BUILDER_PREVIEW__?.__chartToggleCacheBaseline; return !!baseline && baseline.startCount === 0 && baseline.errorCount === 0 && baseline.successCount === 0 && baseline.requestCount === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 1 && preview.fetchBehaviors[0]?.match?.type === 'chartquery' && preview.fetchBehaviors[0]?.delayMs === 1500; })()",
      timeoutMs: 60000,
    },
    buildPreviewPatchBuilderStateStep({
      patch: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        chartSpec: {
          title: "Avails by Date and Channel",
          type: "area",
          xField: "eventDate",
          yFields: ["avails"],
          seriesField: "channelV2",
          eyebrow: "Visual Story",
          accentTone: "delivery",
          highlights: ["Split by Channel", "Trend View", "Full Query"],
        },
        viewMode: "chart",
        staticFilters: {
          dateRange: { start: "2026-05-01", end: "2026-05-04" },
        },
      },
    }),
    {
      type: "waitForDomContains",
      text: "Avails by Date and Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__chartToggleCacheBaseline; if (!preview || !baseline) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; return startCount === baseline.startCount + 1; })()",
      timeoutMs: 60000,
    },
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
      type: "waitForEval",
      expression: "(() => !!document.querySelector('.forge-report-builder__table-wrap'))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__chartToggleCacheBaseline; if (!preview || !baseline) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; return startCount === baseline.startCount + 1 && successCount === baseline.successCount; })()",
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__chartToggleCacheBaseline; if (!preview || !baseline) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount + 1 && successCount === baseline.successCount + 1 && requestCount === baseline.requestCount + 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const current = { startCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length }; const settled = preview.__chartToggleSettledCounts; const changed = !settled || settled.startCount !== current.startCount || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount || settled.requestCount !== current.requestCount; if (changed) { preview.__chartToggleSettledCounts = { ...current, lastChangedAt: Date.now() }; return false; } return Date.now() - settled.lastChangedAt >= 1200; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__chartToggleCacheBaseline; if (!preview || !baseline) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === baseline.startCount + 1 && errorCount === baseline.errorCount && successCount === baseline.successCount + 1 && requestCount === baseline.requestCount + 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-toggle-cache.png",
      fullPage: true,
    },
  ],
};
