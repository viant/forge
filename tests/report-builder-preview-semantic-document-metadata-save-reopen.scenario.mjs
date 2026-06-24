import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

function buildDocumentMetadataAuthoringSteps() {
  return [
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Report document title\"]",
      value: "Executive Snapshot",
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Report document subtitle\"]",
      value: "Weekly Rollup",
    },
    {
      type: "fillSelector",
      selector: "textarea[aria-label=\"Report document description\"]",
      value: "Authored document metadata from the live builder.",
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').includes('Household Uniques'))); if (!button) { throw new Error('Household Uniques measure button not found.'); } button.click(); return true; })()",
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
      text: "Saved exploration artifact: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored document metadata from the live builder.",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"reportBuilder.explorationArtifact\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect artifact",
    },
    {
      type: "waitForDomContains",
      text: "\"kind\": \"reportBuilder.explorationArtifact\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored document metadata from the live builder.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder__runtime-preview'); const text = root?.innerText || root?.textContent || ''; return text.includes('Executive Snapshot') && text.includes('Weekly Rollup') && text.includes('Authored document metadata from the live builder.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"title\": \"Executive Snapshot\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect report payload",
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Executive Snapshot\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"subtitle\": \"Weekly Rollup\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"description\": \"Authored document metadata from the live builder.\"",
      timeoutMs: 60000,
    },
  ];
}

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...buildDocumentMetadataAuthoringSteps(),
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
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Prepare get response')); if (!button) { throw new Error('Prepare get response button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored document metadata from the live builder.",
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
      type: "waitForDomContains",
      text: "Weekly Rollup",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Authored document metadata from the live builder.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect list response",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[aria-label=\"List ReportDocuments response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"listReportDocumentsResponse\"') && text.includes('\"title\": \"Executive Snapshot\"') && text.includes('\"subtitle\": \"Weekly Rollup\"') && text.includes('\"description\": \"Authored document metadata from the live builder.\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Open selected response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect get response",
    },
    {
      type: "waitForEval",
      expression: "!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"title\": \"Executive Snapshot\"') && text.includes('\"subtitle\": \"Weekly Rollup\"') && text.includes('\"description\": \"Authored document metadata from the live builder.\"'); })()",
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
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Executive Snapshot for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Executive Snapshot",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return state?.reportDocumentTitle === 'Executive Snapshot' && state?.reportDocumentSubtitle === 'Weekly Rollup' && state?.reportDocumentDescription === 'Authored document metadata from the live builder.'; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Governed reporting model for the report builder preview.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Daily delivery grain",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Approved buying channel",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Certified available inventory",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Approved household reach metric",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('[data-report-runtime-binding-panel=\"semantic\"]'); const text = (panel?.innerText || panel?.textContent || ''); return text.includes('SELECTED MEASURES (2)') && text.includes('CERTIFIED') && text.includes('REVIEWED') && text.includes('Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-document-metadata-save-reopen.png",
      fullPage: true,
    },
  ],
};
