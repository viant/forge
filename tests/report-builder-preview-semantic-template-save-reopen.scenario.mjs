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
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.includes('Executive Summary') && titles.includes('Headline KPI'); })()",
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
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')); const panel = panels.find((node) => ((node.innerText || node.textContent || '').includes('Saved report payload: Market Brief'))); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Dimensions Country') && text.includes('Measures Available Impressions, Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "\"title\": \"Market Brief\"",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Inspect report payload",
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Market Brief\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"subtitle\": \"Q2 Coverage\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"description\": \"Template-seeded authored market brief.\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Executive Summary\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Headline KPI\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportDocumentTemplateId\": \"market_brief\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"reportDocumentTemplateLabel\": \"Market Brief\"",
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
      text: "Get ReportDocument response: Market Brief",
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
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"title\": \"Market Brief\"') && text.includes('\"subtitle\": \"Q2 Coverage\"') && text.includes('\"description\": \"Template-seeded authored market brief.\"') && text.includes('\"title\": \"Executive Summary\"') && text.includes('\"title\": \"Headline KPI\"') && text.includes('\"reportDocumentTemplateId\": \"market_brief\"') && text.includes('\"reportDocumentTemplateLabel\": \"Market Brief\"'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Reopen in builder')); if (!button) { throw new Error('Reopen in builder button not found.'); } button.click(); })()",
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
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return state?.reportDocumentTitle === 'Market Brief' && state?.reportDocumentSubtitle === 'Q2 Coverage' && state?.reportDocumentDescription === 'Template-seeded authored market brief.' && state?.reportDocumentTemplateId === 'market_brief' && state?.reportDocumentTemplateLabel === 'Market Brief' && titles.includes('Executive Summary') && titles.includes('Headline KPI'); })()",
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
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('queued') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('Household Uniques'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is queued.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Refresh status",
    },
    {
      type: "waitForDomContains",
      text: "Export demo-export-job-1 is succeeded.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-artifact-1') && text.includes('succeeded'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Download artifact",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Market Brief.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-demo Market Brief')",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-template-save-reopen.png",
      fullPage: true,
    },
  ],
};
