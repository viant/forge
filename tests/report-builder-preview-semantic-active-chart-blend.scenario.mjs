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
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails + HH Uniques by Date",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Avails + HH Uniques by Date",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const header = document.querySelector('.forge-report-builder__result-header'); const text = (header?.innerText || header?.textContent || ''); return text.includes('Chart-first view for the active scope') && text.includes('KPI BLEND') && text.includes('Dual Axis') && text.includes('Reach + Volume') && text.includes('Full Query'); })()",
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
      type: "waitForDomContains",
      text: "Dimensions Delivery Date",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions, Household Uniques",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const cards = Array.from(document.querySelectorAll('section')); const runtime = cards.find((entry) => ((entry.innerText || entry.textContent || '')).includes('Compiled Report Runtime Preview')); const text = runtime?.innerText || runtime?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date') && text.includes('Measures Available Impressions, Household Uniques') && text.includes('Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-active-chart-blend.png",
      fullPage: true,
    },
  ],
};
