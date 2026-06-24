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
    buildSectionButtonClickStep({
      sectionIncludes: "Saved report payload: Report Builder Demo",
      sectionSelector: ".forge-report-builder__chart-inline-notice",
      buttonTexts: ["Inspect export", "Hide export"],
      missingSectionMessage: "Saved report payload section not found.",
      missingButtonMessage: "Inspect export button not found for saved report payload.",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Saved export request summary\"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const text = container?.innerText || container?.textContent || ''; const pre = container?.querySelector('pre'); const raw = pre?.textContent || ''; try { const parsed = JSON.parse(raw || '{}'); const reportPrint = parsed?.reportPrint || {}; return text.includes('Semantic Binding') && text.includes('Model Ad Delivery') && text.includes('Entity Line Delivery') && text.includes('Available Impressions') && parsed?.kind === 'reportExportRequest' && parsed?.target?.format === 'pdf' && reportPrint?.kind === 'reportPrint' && raw.includes('Top Regions') && raw.includes('Total Available Impressions: 2,180,000') && raw.includes('2 Regions') && raw.includes('Top: CA') && raw.includes('CA') && raw.includes('WA'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected measures (1)",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Available Impressions",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Saved export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Saved export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Download export request')); if (!button) { throw new Error('Download export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Report Builder Demo-savedPayload-pdf-export-request.json' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { if (!window.__artifactDownloadCapture?.payloadReady) { return false; } const raw = window.__artifactDownloadCapture?.payload || ''; if (!window.__artifactDownloadCapture?.mimeType?.includes('application/json') || !raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint || {}; return parsed?.kind === 'reportExportRequest' && parsed?.target?.format === 'pdf' && reportPrint?.kind === 'reportPrint' && raw.includes('Top Regions') && raw.includes('Total Available Impressions: 2,180,000') && raw.includes('2 Regions') && raw.includes('Top: CA') && raw.includes('CA') && raw.includes('WA'); } catch (_) { return false; } })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-authored-geo-export-request.png",
      fullPage: true,
    },
  ],
};
