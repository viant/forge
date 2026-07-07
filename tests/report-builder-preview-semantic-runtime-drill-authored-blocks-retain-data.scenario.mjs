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
      expression: "document.querySelectorAll('.forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
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
      expression: "(() => { const root = document.querySelector('[aria-label=\"Authored runtime preview\"]') || document.body; const text = root.innerText || root.textContent || ''; return !text.includes('No data.') && !text.includes('No headline KPI value available.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')); const table = panels.find((entry) => (entry.innerText || '').includes('Publisher')); const comparison = panels.find((entry) => (entry.innerText || '').includes('Delivery Comparison')); return !!table && !!comparison && (table.innerText || '').includes('Acme Media') && (comparison.innerText || '').includes('DISPLAY'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-drill-authored-blocks-retain-data.png",
      fullPage: true,
    },
  ],
};
