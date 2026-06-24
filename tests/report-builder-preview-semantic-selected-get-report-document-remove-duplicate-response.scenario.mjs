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
      name: "Add narrative",
    },
    {
      type: "waitForDomContains",
      text: "Add Narrative Block",
      timeoutMs: 60000,
    },
    {
      type: "fillSelector",
      selector: "input[placeholder=\"Narrative\"]",
      value: "Inventory Note",
    },
    {
      type: "fillSelector",
      selector: "textarea[placeholder*=\"## Narrative\"]",
      value: "## Inventory Note\nAuthor-provided inventory context.",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Add Block",
    },
    {
      type: "waitForDomContains",
      text: "Inventory Note added to the report document.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Duplicate Inventory Note",
    },
    {
      type: "waitForDomContains",
      text: "Inventory Note Copy duplicated in the authored report document.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => entry.getAttribute('aria-label') === 'Remove Inventory Note'); if (!button) { throw new Error('Remove Inventory Note button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Inventory Note removed from the authored report document.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.length === 1 && titles[0] === 'Inventory Note Copy'; })()",
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
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.length === 1 && titles[0] === 'Inventory Note Copy'; })()",
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
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('[data-report-runtime-binding-panel=\"semantic\"]')).find((node) => node && node.offsetParent !== null); const text = (panel?.innerText || panel?.textContent || ''); return text.includes('Governed reporting model for the report builder preview.') && text.includes('Daily delivery grain') && text.includes('Approved buying channel') && text.includes('Certified available inventory') && text.includes('Approved household reach metric') && text.includes('SELECTED MEASURES (2)') && text.includes('Available Impressions') && text.includes('Household Uniques') && text.includes('CERTIFIED') && text.includes('REVIEWED'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card')).filter((node) => node && node.offsetParent !== null).map((card) => (card.querySelector('strong')?.innerText || card.querySelector('strong')?.textContent || '').trim()).filter(Boolean); return titles.length === 1 && titles[0] === 'Inventory Note Copy'; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); if (!root) { return false; } const titles = Array.from(root.querySelectorAll('section h3')).map((node) => (node.innerText || node.textContent || '').trim()).filter(Boolean); const bodyMatches = ((root.innerText || root.textContent || '').match(/Author-provided inventory context\\./g) || []).length; return titles.length === 1 && titles[0] === 'Inventory Note Copy' && bodyMatches === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-selected-get-report-document-remove-duplicate-response.png",
      fullPage: true,
    },
  ],
};
