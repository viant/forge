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
      text: "Compiled Runtime Preview",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length > 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !preview.replaceFetchBehaviors) { return false; } preview.__runtimePreviewRetryBaseline = { errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length }; return preview.replaceFetchBehaviors([{ match: { type: 'runtimePreview' }, error: 'Runtime preview fetch failed.' }]); })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Run",
      exact: true,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__runtimePreviewRetryBaseline; if (!preview || !baseline) { return false; } const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'error').length; return errorCount > baseline.errorCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Runtime preview fetch failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.fetchBehaviors && window.__REPORT_BUILDER_PREVIEW__.fetchBehaviors.length === 0",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Run",
      exact: true,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__runtimePreviewRetryBaseline; if (!preview || !baseline) { return false; } const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return successCount > baseline.successCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Runtime preview fetch failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel') != null",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Compiled Runtime Preview",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-preview-retry.png",
      fullPage: true,
    },
  ],
};
