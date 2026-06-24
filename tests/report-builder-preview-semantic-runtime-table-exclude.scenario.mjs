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
      expression: "document.querySelectorAll('.forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Exclude",
      index: 1,
    },
    {
      type: "waitForDomContains",
      text: "Exclude = Display",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Exclude = Display'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).some((panel) => { const text = (panel?.innerText || panel?.textContent || '').toLowerCase(); return text.includes('delivery comparison') && text.includes('ctv') && !text.includes('display'); })",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-runtime-table-exclude-proof.png",
      fullPage: true,
    },
  ],
};
