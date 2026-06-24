import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 720,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForDomContains",
      text: "Date Range",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ staticFilters: { ...(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.staticFilters || {}), dateRange: { start: '2026-05-07', end: '2026-05-01' } } })",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || text.includes('Semantic provider diagnostics') || text.includes('Resolve semantic selection issues'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic provider diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "assertDomContains",
      text: "Date Range start date must be on or before the end date.",
    },
    {
      type: "assertDomContains",
      text: "selection.parameters.reporting_window",
    },
    {
      type: "assertDomContains",
      text: "Resolve semantic selection issues",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__panel--date-range.is-semantic-provider-invalid'); if (!panel) { return false; } const text = panel.innerText || panel.textContent || ''; return text.includes('Date Range start date must be on or before the end date.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); return runButtons.length === 1 && runButtons[0].disabled === true; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ staticFilters: { ...(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.staticFilters || {}), dateRange: { start: '2026-05-01', end: '2026-05-04' } } })",
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Validating the semantic selection against the provider.') || (!text.includes('Semantic provider diagnostics') && !text.includes('Date Range start date must be on or before the end date.') && !text.includes('selection.parameters.reporting_window') && !text.includes('Resolve semantic selection issues')); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const runButtons = Array.from(document.querySelectorAll('button')).filter((button) => (button.innerText || '').trim() === 'Run'); const panel = document.querySelector('.forge-report-builder__panel--date-range'); return !text.includes('Semantic provider diagnostics') && !text.includes('Date Range start date must be on or before the end date.') && !text.includes('selection.parameters.reporting_window') && !text.includes('Resolve semantic selection issues') && !!panel && !panel.classList.contains('is-semantic-provider-invalid') && runButtons.length === 1 && runButtons[0].disabled === false; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-parameter-validation-proof.png",
      fullPage: true,
    },
  ],
};
