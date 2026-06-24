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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('Preview patchBuilderState API not available.'); } const nextState = preview.patchBuilderState({ selectedDimensions: ['country'], selectedMeasures: ['avails'], primaryMeasure: 'avails', viewMode: 'table', chartSpec: null, orderField: 'country', orderDir: 'desc' }); if (!nextState || !Array.isArray(nextState.selectedDimensions) || nextState.selectedDimensions[0] !== 'country') { throw new Error('Failed to pivot builder state to country dimension.'); } return true; })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'geoMapBlock', seed: { title: 'Market Geo' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Market Geo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Market Geo')))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceCollectionRows !== 'function') { throw new Error('Preview replaceCollectionRows API not available.'); } preview.replaceCollectionRows([{ country: 'CA', avails: 1200000 }, { country: 'WA', avails: 980000 }], { hasMore: false, error: null }); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder__runtime-preview'); const text = root?.innerText || root?.textContent || ''; return text.includes('Market Geo') && text.includes('2 Regions') && text.includes('Total Avails: 2,180,000') && text.includes('CA') && text.includes('WA'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('beginStandaloneDraft API not available.'); } return !!preview.beginStandaloneDraft({ sourceLabel: 'the current result state', patch: { __scenarioDraft: true } }); })()",
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
      type: "waitForDomContains",
      text: "\"kind\": \"geoMapBlock\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Market Geo\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"shape\": \"us-states\"",
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
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Prepare get response')); if (!button) { throw new Error('Prepare get response button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"kind\": \"getReportDocumentResponse\"",
      timeoutMs: 60000,
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
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"kind\": \"geoMapBlock\"') && text.includes('\"title\": \"Market Geo\"') && text.includes('\"shape\": \"us-states\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.removeAuthoredDocumentBlock !== 'function') { throw new Error('removeAuthoredDocumentBlock API not available.'); } return !!preview.removeAuthoredDocumentBlock('geoMapBlock'); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => !Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Market Geo')))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Report Builder Demo for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some((node) => ((node.innerText || node.textContent || '').trim() === 'Market Geo')))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = document.querySelector('.forge-report-builder__runtime-preview'); const text = root?.innerText || root?.textContent || ''; return text.includes('Market Geo') && text.includes('2 Regions') && text.includes('Total Avails: 2,180,000') && text.includes('CA') && text.includes('WA'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-geo-save-reopen.png",
      fullPage: true,
    },
  ],
};
