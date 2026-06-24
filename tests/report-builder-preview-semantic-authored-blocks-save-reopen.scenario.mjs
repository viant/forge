import {
  buildPreviewBootstrapSteps,
  buildSectionButtonClickStep,
  buildReopenedHydratedSessionVerificationSteps,
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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'markdownBlock', seed: { id: 'markdownBlock', title: 'Inventory Note', markdown: '## Inventory Note\\nAuthor-provided inventory context.' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Inventory Note",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'kpiBlock', seed: { id: 'kpiBlock', title: 'Reach KPI' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Reach KPI",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.moveAuthoredDocumentBlock !== 'function') { throw new Error('moveAuthoredDocumentBlock API not available.'); } return !!preview.moveAuthoredDocumentBlock('kpiBlock', 'up'); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.length >= 2 && titles[0] === 'Reach KPI' && titles[1] === 'Inventory Note'; })()",
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
      text: "\"title\": \"Reach KPI\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"title\": \"Inventory Note\"",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; const primary = text.indexOf('\"blockId\": \"primaryBuilder\"'); const kpi = text.indexOf('\"blockId\": \"kpiBlock\"'); const markdown = text.indexOf('\"blockId\": \"markdownBlock\"'); return primary >= 0 && kpi > primary && markdown > kpi; })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Saved report payload: Report Builder Demo",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "Saved report payload section not found.",
      missingButtonMessage: "Inspect export button not found for saved report payload.",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Saved export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; const pre = container?.querySelector('pre'); const raw = pre?.textContent || ''; try { const parsed = JSON.parse(raw || '{}'); const reportPrint = parsed?.reportPrint || {}; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && parsed?.kind === 'reportExportRequest' && parsed?.target?.format === 'pdf' && reportPrint?.kind === 'reportPrint' && raw.includes('Reach KPI') && raw.includes('Inventory Note') && raw.includes('Author-provided inventory context.'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    buildSectionButtonClickStep({
      sectionIncludes: "Saved report payload: Report Builder Demo",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Export snapshot", "Review export"],
      missingSectionMessage: "Saved report payload section not found.",
      missingButtonMessage: "Export snapshot button not found for saved report payload.",
    }),
    {
      type: "waitForDomContains",
      text: "Accepted PDF export for Report Builder Demo.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('demo-export-job-1') && text.includes('queued') && text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Reach KPI') && text.includes('Inventory Note'); })()",
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
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Report Builder Demo.pdf' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.mimeType === 'application/pdf' && window.__artifactDownloadCapture.payload.includes('%PDF-demo Report Builder Demo')",
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
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; const primary = text.indexOf('\"blockId\": \"primaryBuilder\"'); const kpi = text.indexOf('\"blockId\": \"kpiBlock\"'); const markdown = text.indexOf('\"blockId\": \"markdownBlock\"'); return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"title\": \"Reach KPI\"') && text.includes('\"title\": \"Inventory Note\"') && primary >= 0 && kpi > primary && markdown > kpi; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.removeAuthoredDocumentBlock !== 'function') { throw new Error('removeAuthoredDocumentBlock API not available.'); } return !!preview.removeAuthoredDocumentBlock('markdownBlock'); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.length === 1 && titles[0] === 'Reach KPI'; })()",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 11,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const titles = Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).map((node) => (node.innerText || node.textContent || '').trim()); return titles.length >= 2 && titles[0] === 'Reach KPI' && titles[1] === 'Inventory Note'; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); if (!root) { return false; } const titles = Array.from(root.querySelectorAll('section h3')).map((node) => (node.innerText || node.textContent || '').trim()).filter(Boolean); const bodyMatches = ((root.innerText || root.textContent || '').match(/Author-provided inventory context\\./g) || []).length; return titles.length >= 2 && titles[0] === 'Reach KPI' && titles[1] === 'Inventory Note' && bodyMatches >= 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-blocks-save-reopen.png",
      fullPage: true,
    },
  ],
};
