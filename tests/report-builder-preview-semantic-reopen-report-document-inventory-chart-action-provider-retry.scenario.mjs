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
      text: "Selected entry: Capacity Inventory Top Channels Q3",
      timeoutMs: 60000,
    },
    ...buildSelectedReportDocumentPreparationSteps({
      reportId: "capacityInventoryTopChannelsQ3",
      responseTitle: "Get ReportDocument response: Capacity Inventory Top Channels Q3",
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
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'chartBlock', fieldRef: 'channelV2' }, delayMs: 200, error: 'Preview runtime action provider failed.' }])",
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity Inventory Top Channels Q3",
      reportId: "capacityInventoryTopChannelsQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForDomContains",
      text: "Template: Capacity Inventory Brief",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).some((entry) => !entry.closest('.forge-report-builder__runtime-preview'))",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Failed to load refinement actions for Channel.') && text.includes('Preview runtime action provider failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('button')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry action provider') && !entry.closest('.forge-report-builder__runtime-preview')))()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'chartBlock', fieldRef: 'channelV2' }, delayMs: 1200, actions: [{ id: 'detail_channel', label: 'Show channel details', kind: 'detail', targetRef: 'target://example/performance/channel-detail' }] }])",
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retry action provider') && !entry.closest('.forge-report-builder__runtime-preview')); if (!button) { throw new Error('Retry action provider button not found in reopened inventory chart surface.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => Array.from(document.querySelectorAll('button')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Retrying action provider') && !entry.closest('.forge-report-builder__runtime-preview')))()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Failed to load refinement actions for Channel.') && !text.includes('Preview runtime action provider failed.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const mark = panel?.querySelector('.recharts-bar-rectangle'); if (!mark) { throw new Error('Reopened inventory chart mark not found after retry.'); } mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Show channel details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const panel = Array.from(document.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const button = Array.from(panel?.querySelectorAll('.forge-report-runtime-chart-action') || []).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Show channel details')); if (!button) { throw new Error('Show channel details action not found after provider retry.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const panels = Array.from(document.querySelectorAll('.forge-report-runtime-host-intent, .forge-report-runtime-chart-panel, .forge-report-runtime-table-panel')).filter((entry) => !entry.closest('.forge-report-builder__runtime-preview')); const text = panels.map((entry) => entry.innerText || entry.textContent || '').join(' '); return text.includes('target://example/performance/channel-detail') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-inventory-chart-action-provider-retry.png",
      fullPage: true,
    },
  ],
};
