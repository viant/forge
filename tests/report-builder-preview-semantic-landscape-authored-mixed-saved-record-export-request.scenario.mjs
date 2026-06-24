import { readFileSync } from "node:fs";

import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const mixedReportPrintFixture = JSON.parse(readFileSync(
  new URL("../src/reporting/fixtures/authored-landscape-mixed-report-print-fixture.v1.json", import.meta.url),
  "utf8",
));

const expectedReportPrintSignature = {
  pageGeometry: mixedReportPrintFixture.pageGeometry,
  pages: (mixedReportPrintFixture.pages || []).map((page) => ({
    number: page.number,
    elements: (page.elements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    headerElements: (page.headerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    footerElements: (page.footerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
  })),
  diagnostics: mixedReportPrintFixture.diagnostics || [],
};

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps({ captureDownloads: true }),
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const select = document.querySelector('select[aria-label=\"List response entry\"]'); if (!select) { return false; } return !Array.from(select.options || []).some((option) => option.value === 'authoredLandscapeMixedPreview'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.getSeededSavedReportPayloads !== 'function' || typeof api.replaceSeededSavedReportPayloads !== 'function') { throw new Error('Preview seeded saved payload API not available.'); } return import('/src/reporting/fixtures/authoredLandscapeMixedSavedReportRecordBuilder.js').then(({ buildAuthoredLandscapeMixedSavedReportRecord }) => { const record = buildAuthoredLandscapeMixedSavedReportRecord({ containerId: 'demoReportBuilder', stateKey: 'demoReportBuilder', reportId: 'authoredLandscapeMixedPreview', payloadId: 'rbreport_authored_landscape_mixed_preview', sourceArtifactId: 'authored_landscape_mixed_preview', savedAt: 9950, documentVersion: 13 }); const existing = api.getSeededSavedReportPayloads(); const next = [...existing.filter((entry) => { const target = entry?.savedReportPayload || entry; const reportId = target?.reportDocument?.id || target?.reportRef?.reportId || target?.reportId || ''; return reportId !== 'authoredLandscapeMixedPreview'; }), record]; const replaced = api.replaceSeededSavedReportPayloads(next); return Array.isArray(replaced) && replaced.some((entry) => { const target = entry?.savedReportPayload || entry; return (target?.reportDocument?.id || '') === 'authoredLandscapeMixedPreview'; }); }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.getSeededSavedReportPayloads !== 'function') { return false; } return api.getSeededSavedReportPayloads().some((entry) => { const target = entry?.savedReportPayload || entry; return (target?.reportDocument?.id || '') === 'authoredLandscapeMixedPreview'; }); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 8 entries",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const select = document.querySelector('select[aria-label=\"List response entry\"]'); if (!select) { return false; } return Array.from(select.options || []).some((option) => option.value === 'authoredLandscapeMixedPreview'); })()",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "authoredLandscapeMixedPreview",
      responseTitle: "Get ReportDocument response: Authored Landscape Mixed Report",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Authored Landscape Mixed Report",
      reportId: "authoredLandscapeMixedPreview",
      documentVersion: 13,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentTitle === 'Authored Landscape Mixed Report' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('totalSpend') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.includes('impressions') && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelId') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.reportDocumentLayout?.items) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().reportDocumentLayout.items.some((item) => item?.blockId === 'stateGeo') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().reportDocumentLayout.items.some((item) => item?.blockId === 'narrativeIntro' && item?.size === 'half') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().reportDocumentLayout.items.some((item) => item?.blockId === 'headlineKpi' && item?.size === 'half')",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Authored Landscape Mixed Report')); if (!reopened) { return false; } const text = reopened.innerText || reopened.textContent || ''; return text.includes('Review export') || text.includes('Inspect export'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const reopened = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Reopened ReportDocument: Authored Landscape Mixed Report')); if (!reopened) { throw new Error('Reopened mixed section not found.'); } const button = Array.from(reopened.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Inspect export' || text === 'Review export'; }); if (!button) { throw new Error('Inspect export button not found in mixed reopened section.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: `(() => { const summary = Array.from(document.querySelectorAll('[aria-label="Reopened export request summary"]')).find(Boolean); if (!summary) { return false; } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const pre = container?.querySelector('pre'); if (!pre) { return false; } try { const parsed = JSON.parse(pre.textContent || '{}'); const reportPrint = parsed?.reportPrint; if (!reportPrint) { return false; } const signature = { pageGeometry: reportPrint.pageGeometry || null, pages: (Array.isArray(reportPrint.pages) ? reportPrint.pages : []).map((page) => ({ number: page?.number ?? null, elements: (Array.isArray(page?.elements) ? page.elements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), headerElements: (Array.isArray(page?.headerElements) ? page.headerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), footerElements: (Array.isArray(page?.footerElements) ? page.footerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })) })), diagnostics: Array.isArray(reportPrint.diagnostics) ? reportPrint.diagnostics : [] }; return JSON.stringify(signature) === ${JSON.stringify(JSON.stringify(expectedReportPrintSignature))}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const summary = Array.from(document.querySelectorAll('[aria-label=\"Reopened export request summary\"]')).find(Boolean); if (!summary) { throw new Error('Reopened export request summary not found.'); } const container = summary.closest('.forge-report-builder__chart-inline-notice'); const button = Array.from(container.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Download export request')); if (!button) { throw new Error('Download export request button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "window.__artifactDownloadCapture && window.__artifactDownloadCapture.filename === 'Authored Landscape Mixed Report-savedPayload-pdf-export-request.json' && window.__artifactDownloadCapture.payloadReady === true",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: `(() => { if (!window.__artifactDownloadCapture?.payloadReady) { return false; } const raw = window.__artifactDownloadCapture?.payload || ''; if (!raw) { return false; } try { const parsed = JSON.parse(raw); const reportPrint = parsed?.reportPrint; const signature = { pageGeometry: reportPrint?.pageGeometry || null, pages: (Array.isArray(reportPrint?.pages) ? reportPrint.pages : []).map((page) => ({ number: page?.number ?? null, elements: (Array.isArray(page?.elements) ? page.elements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), headerElements: (Array.isArray(page?.headerElements) ? page.headerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })), footerElements: (Array.isArray(page?.footerElements) ? page.footerElements : []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })) })), diagnostics: Array.isArray(reportPrint?.diagnostics) ? reportPrint.diagnostics : [] }; return JSON.stringify(signature) === ${JSON.stringify(JSON.stringify(expectedReportPrintSignature))}; } catch (_) { return false; } })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-landscape-authored-mixed-saved-record-export-request.png",
      fullPage: true,
    },
  ],
};
