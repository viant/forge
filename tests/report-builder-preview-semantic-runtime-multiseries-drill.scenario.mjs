import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 390,
    height: 844,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__compact-action",
      text: "Chart",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Create or apply a chart",
      timeoutMs: 60000,
    },
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
      text: "Showing Avails by Date and Channel.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-chart-legend-action",
    },
    {
      type: "waitForDomContains",
      text: "Selected value: Display",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-chart-action",
      text: "Drill to Market",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Drill to Market = Display",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Market = Display'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = document.querySelector('.forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Market') && !labels.includes('Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-runtime-multiseries-drill-proof.png",
      fullPage: true,
    },
  ],
};
