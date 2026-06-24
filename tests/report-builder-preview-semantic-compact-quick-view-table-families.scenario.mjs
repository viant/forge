import {
  buildPreviewBootstrapSteps,
} from "./report-builder-preview-scenario-builders.mjs";

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
      type: "waitForDomContains",
      text: "Tables",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Table-first grids for export-ready delivery and reach reporting.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Delivery Grid",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Grid",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected Dates",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reach Priority",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Delivery Grid",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Showing Delivery Grid.",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__compact-action",
      text: "Chart",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "METRICS PANEL",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Close",
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
      expression: "(() => { const cards = Array.from(document.querySelectorAll('section')); const runtime = cards.find((entry) => ((entry.innerText || entry.textContent || '')).includes('Compiled Report Runtime Preview')); const text = runtime?.innerText || runtime?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel +1') && text.includes('Measures Available Impressions, Household Uniques') && text.includes('Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-compact-quick-view-table-families.png",
      fullPage: true,
    },
  ],
};
