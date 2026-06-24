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
      behaviors: [
        {
          match: {
            type: "chartquery",
          },
          delayMs: 1200,
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
          delayMs: 5000,
          result: {
            rows: [
              { eventDate: "2026-05-03", channelV2: "Audio", hhUniqs: 333 },
              { eventDate: "2026-05-04", channelV2: "Social", hhUniqs: 444 },
            ],
            hasMore: false,
          },
        },
      ],
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 2 && preview.fetchBehaviors[0]?.match?.type === 'chartquery' && preview.fetchBehaviors[0]?.delayMs === 1200 && Array.isArray(preview.fetchBehaviors[0]?.result?.rows) && preview.fetchBehaviors[0]?.result?.rows?.length === 2 && preview.fetchBehaviors[1]?.match?.type === 'chartquery' && preview.fetchBehaviors[1]?.delayMs === 5000 && Array.isArray(preview.fetchBehaviors[1]?.result?.rows) && preview.fetchBehaviors[1]?.result?.rows?.length === 2; })()",
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 1 && endings === 0 && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 1; })()",
      timeoutMs: 5000,
    },
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
      type: "waitForDomContains",
      text: "HH Uniques by Date and Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 2 && endings === 0 && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const root = document.querySelector('.forge-report-builder'); const text = document.body?.innerText || document.body?.textContent || ''; const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; const current = { errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length }; const settled = preview.__chartStaleSuccessWhileLoadingCounts; const changed = !settled || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount; if (changed) { preview.__chartStaleSuccessWhileLoadingCounts = { ...current, lastChangedAt: Date.now() }; return false; } return current.errorCount === 0 && current.successCount === 1 && Date.now() - settled.lastChangedAt >= 350 && root?.getAttribute('data-report-builder-state') === 'chart' && !text.includes('Refreshing report data') && !text.includes(\"We couldn't render these results\") && chartText.includes('Display') && chartText.includes('CTV') && !chartText.includes('Alpha') && !chartText.includes('Beta') && !chartText.includes('Audio') && !chartText.includes('Social'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; return chartText.includes('Audio') && chartText.includes('Social') && !chartText.includes('Alpha') && !chartText.includes('Beta'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 2 && endings === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const current = { startCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length, errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length, requestCount: (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length }; const settled = preview.__chartStaleSuccessWhileLoadingSettledCounts; const changed = !settled || settled.startCount !== current.startCount || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount || settled.requestCount !== current.requestCount; if (changed) { preview.__chartStaleSuccessWhileLoadingSettledCounts = { ...current, lastChangedAt: Date.now() }; return false; } return Date.now() - settled.lastChangedAt >= 1200; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === 2 && errorCount === 0 && successCount === 2 && requestCount === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder'); const header = document.querySelector('.forge-report-builder__result-header'); const headerText = header?.innerText || header?.textContent || ''; const text = document.body?.innerText || document.body?.textContent || ''; const chartWrap = document.querySelector('.forge-report-builder__chart-wrap'); const chartText = chartWrap?.innerText || chartWrap?.textContent || ''; return root?.getAttribute('data-report-builder-state') === 'chart' && headerText.includes('HH Uniques by Date and Channel') && !headerText.includes('Avails by Date and Channel') && !text.includes('Refreshing report data') && !text.includes(\"We couldn't render these results\") && chartText.includes('Audio') && chartText.includes('Social') && !chartText.includes('Alpha') && !chartText.includes('Beta') && !chartText.includes('Display') && !chartText.includes('CTV'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-stale-success-while-loading.png",
      fullPage: true,
    },
  ],
};
