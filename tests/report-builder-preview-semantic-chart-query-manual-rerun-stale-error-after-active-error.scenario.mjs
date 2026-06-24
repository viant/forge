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
          delayMs: 5000,
          error: "Stale chart query failed.",
        },
        {
          match: {
            type: "chartquery",
          },
          error: "Active chart query failed.",
        },
      ],
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 2 && preview.fetchBehaviors[0]?.match?.type === 'chartquery' && preview.fetchBehaviors[0]?.delayMs === 5000 && preview.fetchBehaviors[0]?.error === 'Stale chart query failed.' && preview.fetchBehaviors[1]?.match?.type === 'chartquery' && preview.fetchBehaviors[1]?.error === 'Active chart query failed.'; })()",
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
      type: "waitForDomContains",
      text: "Avails by Date and Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 1 && endings === 0 && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 1; })()",
      timeoutMs: 5000,
    },
    {
      type: "eval",
      expression: "(() => { const button = document.querySelector('.forge-report-builder__run-button'); if (!button) { throw new Error('run button not found'); } if (button.disabled) { throw new Error('run button disabled during manual rerun active error ownership setup'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const requests = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery'); const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start'); const fingerprints = Array.from(new Set(requests.map((entry) => entry.requestFingerprint).filter(Boolean))); const requestKeys = Array.from(new Set(requests.map((entry) => entry.requestKey).filter(Boolean))); return starts.length === 2 && requests.length === 2 && fingerprints.length === 1 && requestKeys.length === 2 && Array.isArray(preview.fetchBehaviors) && preview.fetchBehaviors.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const preview = window.__REPORT_BUILDER_PREVIEW__; const current = { errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length }; const settled = preview.__chartManualRerunErrorOwnershipPreStaleCounts; const changed = !settled || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount; if (changed) { preview.__chartManualRerunErrorOwnershipPreStaleCounts = { ...current, lastChangedAt: Date.now() }; return false; } return current.errorCount === 1 && current.successCount === 0 && Date.now() - settled.lastChangedAt >= 350 && text.includes('Active chart query failed.') && !text.includes('Stale chart query failed.') && text.includes(\"We couldn't render these results\"); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const endings = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 2 && endings === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const preview = window.__REPORT_BUILDER_PREVIEW__; const current = { errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length }; const settled = preview.__chartManualRerunErrorOwnershipFinalCounts; const changed = !settled || settled.errorCount !== current.errorCount || settled.successCount !== current.successCount; if (changed) { preview.__chartManualRerunErrorOwnershipFinalCounts = { ...current, lastChangedAt: Date.now() }; return false; } return current.errorCount === 2 && current.successCount === 0 && Date.now() - settled.lastChangedAt >= 1200 && text.includes('Active chart query failed.') && !text.includes('Stale chart query failed.') && text.includes(\"We couldn't render these results\"); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const startCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'start').length; const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'error').length; const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'chartQuery' && entry.phase === 'success').length; const requestCount = (preview.fetchRequestHistory || []).filter((entry) => entry.type === 'chartQuery').length; return startCount === 2 && errorCount === 2 && successCount === 0 && requestCount === 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const header = document.querySelector('.forge-report-builder__result-header'); const headerText = header?.innerText || header?.textContent || ''; const frame = document.querySelector('.forge-report-builder__result-frame'); const frameText = frame?.innerText || frame?.textContent || ''; const chartWrap = frame?.querySelector('.forge-report-builder__chart-wrap'); return headerText.includes('Avails by Date and Channel') && frameText.includes('Active chart query failed.') && !frameText.includes('Stale chart query failed.') && !chartWrap; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-chart-query-manual-rerun-stale-error-after-active-error.png",
      fullPage: true,
    },
  ],
};
