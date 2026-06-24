import {
  buildPreviewBootstrapSteps,
  buildSectionButtonClickStep,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    {
      type: "clickRole",
      role: "button",
      name: "Apply template",
    },
    {
      type: "clickSelectorContains",
      selector: ".bp6-menu-item",
      text: "Market Brief",
    },
    {
      type: "waitForDomContains",
      text: "Market Brief applied.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Seeded from template: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Fork from here",
    },
    {
      type: "waitForDomContains",
      text: "Exploration Session.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Save artifact",
    },
    {
      type: "waitForDomContains",
      text: "Saved exploration artifact: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare report payload",
    },
    {
      type: "waitForDomContains",
      text: "Saved report payload: Market Brief",
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
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Prepare get response')); if (!button) { throw new Error('Prepare get response button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument Market Brief for editing.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Market Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return state?.reportDocumentTitle === 'Market Brief' && state?.reportDocumentTemplateId === 'market_brief' && state?.reportDocumentTemplateLabel === 'Market Brief' && titles.includes('Executive Summary') && titles.includes('Headline KPI'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'reopened', format: 'pdf', title: 'Market Brief' }, error: 'Preview export submit was rejected for Market Brief.', result: { jobId: 'demo-export-job-submit-failed-reopened', status: 'failed', artifactRef: 'reportBuilder.reportDocument://market_brief', format: 'pdf', scope: 'reopened', error: 'Preview export submit was rejected for Market Brief.' } }]); return true; })()",
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Reopened ReportDocument: Market Brief",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "Reopened Market Brief section not found.",
      missingButtonMessage: "Export snapshot button not found in reopened Market Brief section.",
    }),
    {
      type: "waitForDomContains",
      text: "Preview export submit was rejected for Market Brief.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques') && text.includes('demo-export-job-submit-failed-reopened') && text.includes('failed') && text.includes('Preview export submit was rejected for Market Brief.') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Reopened export: Market Brief'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-template-save-reopen-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
