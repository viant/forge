import {
  buildPreviewBootstrapSteps,
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
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "waitForDomContains",
      text: "HOUSEHOLD METRICS",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Priority",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Market Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Export Ready",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Reach Grid",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "(() => (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Reach Grid'))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored Runtime",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Compiled Report Runtime Preview",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Model Ad Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Entity Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const cards = Array.from(document.querySelectorAll('section')); const runtime = cards.find((entry) => ((entry.innerText || entry.textContent || '')).includes('Compiled Report Runtime Preview')); const text = runtime?.innerText || runtime?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Household Uniques') && text.includes('Market') && text.includes('Channel') && text.includes('Delivery Date') && text.includes('Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-active-reach-grid.png",
      fullPage: true,
    },
  ],
};
