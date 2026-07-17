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
    buildPreviewFetchBehaviorReplacementStep({
      resetCounters: true,
      behaviors: [{
        match: {
          type: "chartquery",
        },
        delayMs: 5000,
      }],
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 1 && preview.fetchBehaviors[0]?.match?.type === 'chartquery' && preview.fetchBehaviors[0]?.delayMs === 5000; })()",
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
        },
        viewMode: "chart",
        staticFilters: {
          dateRange: { start: "2026-05-01", end: "2026-05-04" },
        },
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length === 0; })()",
      timeoutMs: 2000,
    },
    {
      type: "waitForDomContains",
      text: "Avails by Date and Channel",
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
      expression: "(() => !!document.querySelector('.forge-report-builder__table-wrap'))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder'); return root?.getAttribute('data-report-builder-state') === 'table'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__result-header .forge-report-builder__view-toggle button",
      text: "chart",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Avails by Date and Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 1 && endings === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const current = { startCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length }; const settled = preview.__chartInflightHideShowSettledCounts; const changed = !settled || settled.startCount !== current.startCount || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount || settled.requestCount !== current.requestCount; if (changed) { preview.__chartInflightHideShowSettledCounts = { ...current, lastChangedAt: Date.now() }; return false; } return Date.now() - settled.lastChangedAt >= 1200; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === 1 && errorCount === 0 && successCount === 1 && requestCount === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return !!document.querySelector('.forge-report-builder__chart-wrap') && !text.includes('Refreshing report data') && !text.includes('We couldn\\'t render these results'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-inflight-hide-show.png",
      fullPage: true,
    },
  ],
};
