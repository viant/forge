import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'tableBlock', seed: { id: 'comparisonTable', title: 'Comparison Table', columnKeys: ['channelV2', 'avails'], columns: [{ key: 'channelV2', label: 'Channel' }, { key: 'avails', label: 'Available Impressions', format: 'compactNumber', cellVisual: { kind: 'dataBar', valueField: 'avails', range: { mode: 'columnMax' }, palette: ['#dbeafe', '#2563eb'] } }] } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Comparison Table",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Comparison Table'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Available Impressions data bar'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const bars = Array.from(document.querySelectorAll('.forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]')); return bars.some((bar) => { const style = bar.getAttribute('style') || ''; return style.includes('linear-gradient') && !style.includes('width: 0%') && style.includes('width:'); }); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('beginStandaloneDraft API not available.'); } return !!preview.beginStandaloneDraft({ sourceLabel: 'the current result state', patch: { __scenarioDraft: true } }); })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"cellVisual\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"dataBar\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"valueField\": \"avails\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"mode\": \"columnMax\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Comparison Table\"",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "11",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 11.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Prepare get response')); if (!button) { throw new Error('Prepare get response button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"title\": \"Comparison Table\"') && text.includes('\"kind\": \"dataBar\"') && text.includes('\"valueField\": \"avails\"') && text.includes('\"mode\": \"columnMax\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.removeAuthoredDocumentBlock !== 'function') { throw new Error('removeAuthoredDocumentBlock API not available.'); } return !!preview.removeAuthoredDocumentBlock('comparisonTable'); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => !Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Comparison Table')))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Report Builder Demo for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Comparison Table'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Available Impressions data bar'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((node) => ((node.innerText || node.textContent || '').includes('Comparison Table'))); if (!panel) { return false; } const text = panel.innerText || panel.textContent || ''; if (!text.includes('Available Impressions')) { return false; } const bars = Array.from(panel.querySelectorAll('.forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]')); return bars.some((bar) => { const style = bar.getAttribute('style') || ''; return style.includes('linear-gradient') && !style.includes('width: 0%') && style.includes('width:'); }); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-table-databar-save-reopen.png",
      fullPage: true,
    },
  ],
};
