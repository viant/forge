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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'savedPayload', format: 'pdf', artifactRef: 'reportBuilder.savedReportPayload://rbreport_demoReportBuilder', title: 'Report Builder Demo' }, error: 'Preview export submit was rejected for Report Builder Demo.', result: { jobId: 'demo-export-job-submit-failed-blocks', status: 'failed', artifactRef: 'reportBuilder.savedReportPayload://rbreport_demoReportBuilder', format: 'pdf', scope: 'savedPayload', error: 'Preview export submit was rejected for Report Builder Demo.' } }]); return true; })()",
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
      text: "Preview export submit was rejected for Report Builder Demo.",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Reach KPI') && text.includes('Inventory Note') && text.includes('demo-export-job-submit-failed-blocks') && text.includes('failed') && text.includes('Preview export submit was rejected for Report Builder Demo.') && !text.includes('demo-export-job-1'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Saved export: Report Builder Demo'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === '' && window.__artifactDownloadCapture.payloadReady === false",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-blocks-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
