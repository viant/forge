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
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails by Date and Channel",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Avails by Date and Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Chart-first view for the active scope",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { document.querySelector('.forge-report-builder__runtime-preview .forge-chart-legend-action')?.click(); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-chart-action')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show channel details')); if (button) { button.click(); } })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('target://example/performance/channel-detail') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Dismiss intent')); if (button) { button.click(); } })()",
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') == null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-runtime-chart-panel .forge-chart-legend-action').length >= 4",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); panel?.querySelector('.forge-chart-legend-action')?.click(); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const button = Array.from(panel?.querySelectorAll('.forge-report-runtime-chart-action') || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show channel details')); if (button) { button.click(); } })()",
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-runtime-host-intent')).some((entry) => !entry.closest('.forge-report-builder__runtime-preview') && (entry.innerText || entry.textContent || '').includes('target://example/performance/channel-detail') && (entry.innerText || entry.textContent || '').includes('Display')))()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-chart-detail-parity.png",
      fullPage: true,
    },
  ],
};
