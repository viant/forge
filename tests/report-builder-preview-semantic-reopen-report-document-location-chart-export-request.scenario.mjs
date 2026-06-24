import {
  buildPreviewBootstrapSteps,
  buildReopenedExportInspectionSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedListEntryExportButtonStep,
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
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 15000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
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
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityLocationsTopMarketsQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityLocationsTopMarketsQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'country' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Locations · Top Markets'",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } const nextState = preview.patchBuilderState({ reportDocumentTitle: 'Capacity Locations Top Markets Q3 Live' }); return !!nextState && nextState.reportDocumentTitle === 'Capacity Locations Top Markets Q3 Live'; })()",
    },
    {
      type: "waitForDomContains",
      text: "Capacity Locations Top Markets Q3 Live",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.applyAuthoredDocumentBlock !== 'function') { throw new Error('applyAuthoredDocumentBlock API not available.'); } const result = preview.applyAuthoredDocumentBlock({ kind: 'markdownBlock', seed: { id: 'runtimeNote', title: 'Runtime Note', markdown: '## Runtime Note\\nLive reopened export note.' } }); return !!result?.valid; })()",
    },
    {
      type: "waitForDomContains",
      text: "Runtime Note",
      timeoutMs: 60000,
    },
    ...buildReopenedExportInspectionSteps({
      reopenedNoticeText: "Reopened ReportDocument: Capacity Locations Top Markets Q3",
      expectedFilename: "Capacity Locations Top Markets Q3 Live-savedPayload-pdf-export-request.json",
      exportTitle: "Capacity Locations Top Markets Q3 Live",
      bookmarkId: "bookmark.primaryChart",
      extraPayloadText: "Runtime Note",
    }),
    buildSelectedListEntryExportButtonStep({ mode: "inspect" }),
    {
      type: "waitForEval",
      expression: `(() => {
        const summary = Array.from(document.querySelectorAll('[aria-label="Selected list entry export request summary"]')).find(Boolean);
        if (!summary) { return false; }
        const container = summary.closest('.forge-report-builder__chart-inline-notice');
        const text = container?.innerText || container?.textContent || '';
        const pre = container?.querySelector('pre');
        const raw = pre?.textContent || '';
        return text.includes('savedPayload')
          && raw.includes('"from": "savedPayload"')
          && raw.includes('"payloadId": "rbreport_capacity_q3_locations_top_markets"')
          && raw.includes('"title": "Capacity Locations Top Markets Q3 Live"')
          && raw.includes('Runtime Note');
      })()`,
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-export-request.png",
      fullPage: true,
    },
  ],
};
