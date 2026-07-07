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
      type: "waitForEval",
      expression: "(() => { const button = document.querySelector('.forge-report-builder__left-resizer-dock'); const builder = document.querySelector('.forge-report-builder'); return !!button && !!builder && !builder.classList.contains('forge-report-builder--result-left') && (button.textContent || '').includes('Swap'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = document.querySelector('.forge-report-builder__left-resizer-dock'); if (!button) { throw new Error('Result pane swap control not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = document.querySelector('.forge-report-builder__left-resizer-dock'); const builder = document.querySelector('.forge-report-builder'); return !!button && !!builder && builder.classList.contains('forge-report-builder--result-left') && button.getAttribute('aria-label') === 'Move results to right side'; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-result-pane-toggle.png",
      fullPage: true,
    },
  ],
};
