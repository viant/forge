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
      type: "clickSelectorContains",
      selector: ".forge-report-builder__measure-pill",
      text: "Household Uniques",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Saved report payload: Report Builder Demo'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Expected version\"]",
      value: "7",
    },
    {
      type: "waitForDomContains",
      text: "Using expected version 7.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare update payload",
    },
    {
      type: "waitForDomContains",
      text: "Update ReportDocument payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Update ReportDocument payload: Report Builder Demo'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"updateReportDocumentPayload\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect update payload",
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"updateReportDocumentPayload\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"expectedVersion\": 7",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"document\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"semanticSummary\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"modelLabel\": \"Ad Delivery\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"entityLabel\": \"Line Delivery\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Hide update payload",
    },
    {
      type: "assertDomNotContains",
      text: "\"expectedVersion\": 7",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-update-report-document-payload.png",
      fullPage: true,
    },
  ],
};
