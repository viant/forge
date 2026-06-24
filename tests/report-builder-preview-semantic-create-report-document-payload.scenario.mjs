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
      text: "Reach Rate",
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
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Saved report payload: Report Builder Demo'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare create payload",
    },
    {
      type: "waitForDomContains",
      text: "Create ReportDocument payload: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Create ReportDocument payload: Report Builder Demo'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Delivery Date, Channel') && text.includes('Measures Available Impressions'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"createReportDocumentPayload\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect create payload",
    },
    {
      type: "waitForDomContains",
      text: "Selected dimensions (2)",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Available Impressions",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"createReportDocumentPayload\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"demoReportBuilder\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"compileState\": {",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"status\": \"clean\"",
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
      name: "Hide create payload",
    },
    {
      type: "assertDomNotContains",
      text: "\"compileState\": {",
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-create-report-document-payload.png",
      fullPage: true,
    },
  ],
};
