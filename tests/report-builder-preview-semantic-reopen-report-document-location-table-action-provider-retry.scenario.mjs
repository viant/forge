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
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
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
      text: "Selected entry: Capacity Location Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityLocationQ3",
      responseTitle: "Get ReportDocument response: Capacity Location Q3",
    }),
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'tableBlock', fieldRef: 'country' }, delayMs: 200, error: 'Preview runtime action provider failed.' }])",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Location Q3",
      reportId: "capacityLocationQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).some((entry) => !entry.closest('.forge-report-builder__runtime-preview'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Failed to load refinement actions for Market.') && text.includes('Preview runtime action provider failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('button')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry action provider') && !entry.closest('.forge-report-builder__runtime-preview')))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Show market details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'tableBlock', fieldRef: 'country' }, delayMs: 1200, actions: [{ id: 'detail_market', label: 'Show market details', kind: 'detail', targetRef: 'target://example/performance/market-detail' }] }])",
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry action provider') && !entry.closest('.forge-report-builder__runtime-preview')); if (!button) { throw new Error('Retry action provider button not found in reopened runtime table surface.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('button')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retrying action provider') && !entry.closest('.forge-report-builder__runtime-preview')))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Failed to load refinement actions for Market.') && !text.includes('Preview runtime action provider failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); return Array.from(panel?.querySelectorAll('.forge-dashboard-row-action') || []).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show market details')); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-table-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const button = Array.from(panel?.querySelectorAll('.forge-dashboard-row-action') || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show market details')); if (!button) { throw new Error('Show market details action not found after provider retry.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-host-intent, .forge-report-runtime-table-panel')).filter((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panels.map((entry) => entry.innerText || entry.textContent || '').join(' '); return text.includes('target://example/performance/market-detail') && text.includes('country') && text.includes('CA'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-location-table-action-provider-retry.png",
      fullPage: true,
    },
  ],
};
