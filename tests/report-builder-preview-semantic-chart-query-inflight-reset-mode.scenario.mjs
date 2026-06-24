import {
  buildPreviewBootstrapSteps,
  buildPreviewFetchBehaviorReplacementStep,
  buildPreviewPatchBuilderConfigStep,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderConfig !== 'function') { throw new Error('patchBuilderConfig API not available.'); } return !!preview.patchBuilderConfig({ result: { chartDataMode: 'fullQuery', chartRowLimit: 1000 } }); })()",
    },
    buildPreviewFetchBehaviorReplacementStep({
      resetCounters: true,
      behaviors: [
        {
          match: {
            type: "chartquery",
          },
          delayMs: 5000,
          result: {
            rows: [
              { eventDate: "2026-05-01", channelV2: "Alpha", avails: 111 },
              { eventDate: "2026-05-02", channelV2: "Beta", avails: 222 },
            ],
            hasMore: false,
          },
        },
        {
          match: {
            type: "chartquery",
          },
          result: {
            rows: [
              { eventDate: "2026-05-03", channelV2: "Gamma", avails: 555 },
              { eventDate: "2026-05-04", channelV2: "Delta", avails: 666 },
            ],
            hasMore: false,
          },
        },
      ],
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 2 && preview.fetchBehaviors[0]?.match?.type === 'chartquery' && preview.fetchBehaviors[0]?.delayMs === 5000 && Array.isArray(preview.fetchBehaviors[0]?.result?.rows) && preview.fetchBehaviors[0]?.result?.rows?.length === 2 && preview.fetchBehaviors[1]?.match?.type === 'chartquery' && Array.isArray(preview.fetchBehaviors[1]?.result?.rows) && preview.fetchBehaviors[1]?.result?.rows?.length === 2; })()",
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
    buildPreviewPatchBuilderConfigStep({
      patch: {
        result: {
          chartDataMode: "currentPage",
          chartRowLimit: 1000,
        },
      },
    }),
    {
      type: "waitForDomContains",
      text: "Chart-first view for the active scope. Switch to the table when you need to inspect individual rows.",
      timeoutMs: 60000,
    },
    buildPreviewPatchBuilderConfigStep({
      patch: {
        result: {
          chartDataMode: "fullQuery",
          chartRowLimit: 1000,
        },
      },
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length === 2 && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; return chartText.includes('Gamma') && chartText.includes('Delta') && !chartText.includes('Alpha') && !chartText.includes('Beta'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 2 && endings === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const current = { startCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length }; const settled = preview.__chartResetSettledCounts; const changed = !settled || settled.startCount !== current.startCount || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount || settled.requestCount !== current.requestCount; if (changed) { preview.__chartResetSettledCounts = { ...current, lastChangedAt: Date.now() }; return false; } return Date.now() - settled.lastChangedAt >= 1200; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === 2 && errorCount === 0 && successCount === 2 && requestCount === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; return text.includes('Avails by Date and Channel') && text.includes('Chart-first view for the active scope using the full query result set.') && !text.includes('We couldn\\'t render these results') && chartText.includes('Gamma') && chartText.includes('Delta') && !chartText.includes('Alpha') && !chartText.includes('Beta'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-inflight-reset-mode.png",
      fullPage: true,
    },
  ],
};
