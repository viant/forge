import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1440,
    height: 1400,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "waitForDomContains",
      text: "Compiled Report Runtime Preview",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Governed model and field selections compiled into this runtime artifact.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = (panel?.innerText || panel?.textContent || '').toLowerCase(); return text.includes('selected dimensions (2)'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Delivery Date'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = (panel?.innerText || panel?.textContent || '').toLowerCase(); return text.includes('selected measures (2)'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-binding-visibility.png",
      fullPage: true,
    },
  ],
};
