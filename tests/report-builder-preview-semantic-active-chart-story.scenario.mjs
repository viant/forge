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
      text: "VISUAL STORY",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Split by Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Trend View",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Full Query",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails by Date and Channel",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "(() => !!document.querySelector('.forge-report-builder__chart-wrap') && (document.querySelector('.forge-report-builder__result-header h3')?.innerText || '').includes('Avails by Date and Channel'))()",
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
      text: "Dimensions Delivery Date, Channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Measures Available Impressions",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const cards = Array.from(document.querySelectorAll('section')); const runtime = cards.find((entry) => ((entry.innerText || entry.textContent || '')).includes('Compiled Report Runtime Preview')); const text = runtime?.innerText || runtime?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions') && text.includes('Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-active-chart-story.png",
      fullPage: true,
    },
  ],
};
