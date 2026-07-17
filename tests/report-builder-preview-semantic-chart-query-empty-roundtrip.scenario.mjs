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
        delayMs: 1200,
        result: {
          rows: [],
          hasMore: false,
        },
      }],
    }),
    buildPreviewPatchBuilderStateStep({
      patch: {
        selectedMeasures: ["hhUniqs"],
        primaryMeasure: "hhUniqs",
        selectedDimensions: ["eventDate", "channelV2"],
        chartSpec: {
          title: "HH Uniques by Date and Channel",
          type: "area",
          xField: "eventDate",
          yFields: ["hhUniqs"],
          seriesField: "channelV2",
        },
        viewMode: "chart",
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder'); const text = document.body?.innerText || document.body?.textContent || ''; return root?.getAttribute('data-report-builder-view-mode') === 'chart' && root?.getAttribute('data-report-builder-state') === 'chart' && text.includes('No data for the selected period.') && !text.includes('Refreshing report data'); })()",
      timeoutMs: 60000,
    },
    buildPreviewPatchBuilderStateStep({
      patch: {
        viewMode: "table",
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder'); const text = document.body?.innerText || document.body?.textContent || ''; return root?.getAttribute('data-report-builder-view-mode') === 'table' && !text.includes('Refreshing report data') && !!document.querySelector('.forge-report-builder__table-wrap'); })()",
      timeoutMs: 60000,
    },
    buildPreviewPatchBuilderStateStep({
      patch: {
        viewMode: "chart",
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const current = { startCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length }; const settled = preview.__chartEmptyRoundtripSettledCounts; const changed = !settled || settled.startCount !== current.startCount || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount || settled.requestCount !== current.requestCount; if (changed) { preview.__chartEmptyRoundtripSettledCounts = { ...current, lastChangedAt: Date.now() }; return false; } return Date.now() - settled.lastChangedAt >= 600; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const root = document.querySelector('.forge-report-builder'); const text = document.body?.innerText || document.body?.textContent || ''; const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return root?.getAttribute('data-report-builder-view-mode') === 'chart' && root?.getAttribute('data-report-builder-state') === 'chart' && startCount === 1 && errorCount === 0 && successCount === 1 && requestCount === 1 && text.includes('No data for the selected period.') && !text.includes('Refreshing report data') && !text.includes(\"We couldn't render these results\") && !chartText.includes('Display') && !chartText.includes('CTV'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-empty-roundtrip.png",
      fullPage: true,
    },
  ],
};
