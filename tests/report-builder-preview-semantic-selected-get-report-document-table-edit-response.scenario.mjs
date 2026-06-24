import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
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
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 5000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Add table",
      exact: true,
    },
    {
      type: "waitForDomContains",
      text: "Add Table Block",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[placeholder=\"Detail Table\"]",
      value: "Comparison Table",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Add Block",
    },
    {
      type: "waitForDomContains",
      text: "Comparison Table added to the report document.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Edit Comparison Table",
    },
    {
      type: "waitForDomContains",
      text: "Edit Table Block",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const dialog = Array.from(document.querySelectorAll('[role=\"dialog\"]')).find((node) => ((node.innerText || node.textContent || '').includes('Edit Table Block'))); if (!dialog) { throw new Error('Edit Table Block dialog not found.'); } const button = Array.from(dialog.querySelectorAll('button')).find((node) => ((node.innerText || node.textContent || '').includes('Household Uniques'))); if (!button) { throw new Error('Household Uniques column toggle not found.'); } button.click(); })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Apply Changes",
    },
    {
      type: "waitForDomContains",
      text: "Comparison Table updated.",
      timeoutMs: 60000,
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
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "11",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 11.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "demoReportBuilder",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForDomContains",
      text: "listReportDocumentsResponse",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "listReportDocumentsResponse",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).filter((node) => node && node.offsetParent !== null); return panels.some((panel) => { const title = (panel.querySelector('h3')?.innerText || panel.querySelector('h3')?.textContent || '').trim(); const text = panel.innerText || panel.textContent || ''; return title === 'Comparison Table' && text.includes('Delivery Date') && text.includes('Available Impressions') && !text.includes('Household Uniques'); }); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-get-report-document-table-edit-response.png",
      fullPage: true,
    },
  ],
};
