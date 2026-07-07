import {
  buildPreviewBootstrapSteps,
  buildPreviewFetchBehaviorReplacementStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('[aria-label=\"Authored runtime preview\"]') || document.body; const text = root.innerText || root.textContent || ''; return !text.includes('No data.'); })()",
      timeoutMs: 60000,
    },
    buildPreviewFetchBehaviorReplacementStep({
      resetCounters: true,
      behaviors: [{
        match: {
          type: "runtimepreview",
        },
        delayMs: 4000,
      }],
    }),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Publisher",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Publisher = Display",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'start').length; const settled = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 1 && settled === 0; })()",
      timeoutMs: 3000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('[aria-label=\"Authored runtime preview\"]') || document.body; const text = root.innerText || root.textContent || ''; return !text.includes('No data.'); })()",
      timeoutMs: 3000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-first-drill-inflight-retains-collection-rows-loading.png",
      fullPage: true,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } const starts = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'start').length; const settled = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && (entry.phase === 'success' || entry.phase === 'error')).length; return starts === 1 && settled === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('[aria-label=\"Authored runtime preview\"]') || document.body; const text = root.innerText || root.textContent || ''; return !text.includes('No data.') && !text.includes('No headline KPI value available.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')); const table = panels.find((entry) => (entry.innerText || '').includes('Publisher')); return !!table && (table.innerText || '').includes('Acme Media'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-first-drill-inflight-retains-collection-rows-settled.png",
      fullPage: true,
    },
  ],
};
