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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('Preview patchBuilderState API not available.'); } const nextState = preview.patchBuilderState({ selectedDimensions: ['country'], selectedMeasures: ['avails'], primaryMeasure: 'avails', viewMode: 'table', chartSpec: null, orderField: 'country', orderDir: 'desc' }); if (!nextState || !Array.isArray(nextState.selectedDimensions) || nextState.selectedDimensions[0] !== 'country') { throw new Error('Failed to pivot builder state to country dimension.'); } return true; })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'geoMapBlock', seed: { id: 'geoMapBlock', title: 'Market Geo' } }); return !!result?.valid; })()",
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
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceExportBehaviors !== 'function') { throw new Error('preview export behavior api not available'); } preview.replaceExportBehaviors([{ match: { phase: 'submit', source: 'savedPayload', format: 'pdf', artifactRef: 'reportBuilder.savedReportPayload://rbreport_demoReportBuilder', title: 'Report Builder Demo' }, error: 'Preview export submit was rejected for Report Builder Demo.', result: { jobId: 'demo-export-job-submit-failed-geo', status: 'failed', artifactRef: 'reportBuilder.savedReportPayload://rbreport_demoReportBuilder', format: 'pdf', scope: 'savedPayload', error: 'Preview export submit was rejected for Report Builder Demo.' } }]); return true; })()",
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
      expression: "(() => { const text = document.body?.innerText || document.body?.textContent || ''; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && text.includes('demo-export-job-submit-failed-geo') && text.includes('failed') && text.includes('Preview export submit was rejected for Report Builder Demo.') && !text.includes('demo-export-job-1'); })()",
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
      file: "report-builder-preview-semantic-authored-geo-export-submit-failure.png",
      fullPage: true,
    },
  ],
};
