import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildSelectedReportDocumentPreparationSteps,
} from "./report-builder-preview-scenario-builders.mjs";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildPreviewBootstrapSteps(),
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Locations Top Markets Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityLocationsTopMarketsQ3",
      responseTitle: "Get ReportDocument response: Capacity Locations Top Markets Q3",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })",
    },
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'eventDate' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'table' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec == null",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Locations Top Markets Q3",
      reportId: "capacityLocationsTopMarketsQ3",
      documentVersion: 11,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; return !!preview && (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length > 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || !preview.replaceFetchBehaviors) { return false; } preview.__locationChartRuntimeRetryBaseline = { errorCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'error').length, successCount: (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length }; return preview.replaceFetchBehaviors([{ match: { type: 'runtimePreview' }, error: 'Runtime preview fetch failed.' }]); })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Run",
      exact: true,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__locationChartRuntimeRetryBaseline; if (!preview || !baseline) { return false; } const errorCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'error').length; return errorCount > baseline.errorCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(window.__REPORT_BUILDER_PREVIEW__?.fetchBehaviors ?? []).length === 0",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Run",
      exact: true,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__locationChartRuntimeRetryBaseline; if (!preview || !baseline) { return false; } const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return successCount > baseline.successCount; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel') != null",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Runtime preview fetch failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Template: Capacity Location Brief",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } preview.__locationChartDrillSuccessBaseline = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return true; })()",
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Region",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Region ='))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__locationChartDrillSuccessBaseline; if (!preview || baseline == null) { return false; } const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return successCount > baseline; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Region') && !labels.includes('Market'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview) { return false; } preview.__locationChartSecondDrillSuccessBaseline = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return true; })()",
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Drill to Metro Area",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-refinement-chip')).some((node) => (node.innerText || node.textContent || '').includes('Drill to Metro Area ='))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const baseline = preview?.__locationChartSecondDrillSuccessBaseline; if (!preview || baseline == null) { return false; } const successCount = (preview.fetchEventHistory || []).filter((entry) => entry.type === 'runtimePreview' && entry.phase === 'success').length; return successCount > baseline; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const headers = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel')?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Metro Area') && !labels.includes('Region'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-chart-runtime-preview-retry.png",
      fullPage: true,
    },
  ],
};
