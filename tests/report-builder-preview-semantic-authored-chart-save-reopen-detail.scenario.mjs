import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'chartBlock', seed: { id: 'trendChart', title: 'Capacity Trend Block', chartSpec: { title: 'Capacity Trend Block', type: 'area', xField: 'eventDate', yFields: ['avails'], seriesField: 'channelV2' } } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Capacity Trend Block",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Capacity Trend Block')))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); if (!root) { return false; } const panel = Array.from(root.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Capacity Trend Block')); return !!panel && panel.querySelectorAll('.forge-chart-legend-action').length >= 1; })()",
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
      text: "\"kind\": \"chartBlock\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Capacity Trend Block\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"seriesField\": \"channelV2\"",
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
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"kind\": \"chartBlock\"') && text.includes('\"title\": \"Capacity Trend Block\"') && text.includes('\"seriesField\": \"channelV2\"') && text.includes('\"blockId\": \"trendChart\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.removeAuthoredDocumentBlock !== 'function') { throw new Error('removeAuthoredDocumentBlock API not available.'); } return !!preview.removeAuthoredDocumentBlock('trendChart'); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => !Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Capacity Trend Block')))()",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); if (!root) { return false; } const panel = Array.from(root.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Capacity Trend Block')); return !!panel && panel.querySelectorAll('.forge-chart-legend-action').length >= 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Capacity Trend Block')); if (!panel) { throw new Error('Capacity Trend Block runtime panel not found.'); } const action = Array.from(panel.querySelectorAll('.forge-chart-legend-action')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Display')) || panel.querySelector('.forge-chart-legend-action'); if (!action) { throw new Error('Capacity Trend Block legend action not found.'); } action.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Capacity Trend Block')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('Display') && text.includes('Show channel details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Capacity Trend Block')); if (!panel) { throw new Error('Capacity Trend Block runtime panel not found.'); } const action = Array.from(panel.querySelectorAll('.forge-report-runtime-chart-action')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Show channel details')); if (!action) { throw new Error('Capacity Trend Block detail action not found.'); } action.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = root?.querySelector('.forge-report-runtime-host-intent'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('target://example/performance/channel-detail') && text.includes('channel') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-chart-save-reopen-detail.png",
      fullPage: true,
    },
  ],
};
