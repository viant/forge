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
    buildSectionButtonClickStep({
      sectionIncludes: "Reopened ReportDocument: Market Brief",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "Reopened Market Brief section not found.",
      missingButtonMessage: "Export snapshot button not found in reopened Market Brief section.",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Market Brief.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const jobId = preview?.lastExportRequest?.jobId; if (!jobId) { throw new Error('last export job id not found'); } preview.replaceExportBehaviors([{ match: { phase: 'status', jobId }, error: 'Renderer rejected reportPrint for Market Brief.', result: { jobId, status: 'failed', artifactId: '', artifactRef: 'reportBuilder.savedReportPayload://rbreport_market_brief', format: 'pdf', error: 'Renderer rejected reportPrint for Market Brief.', diagnostics: [{ code: 'export.renderUnsupported', severity: 'error', path: '$.reportPrint.pages[0]', message: 'Unsupported chart primitive in current renderer.', suggestedFix: 'Use a print-safe chart preset.' }] } }]); return true; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Renderer rejected reportPrint for Market Brief.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Unsupported chart primitive in current renderer.",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Use a print-safe chart preset.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('failed') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-template-save-reopen-export-status-failure.png",
      fullPage: true,
    },
  ],
};
