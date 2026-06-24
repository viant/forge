import {
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
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
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "12",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 12.",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const api = window.__REPORT_BUILDER_PREVIEW__; if (!api || typeof api.appendSeededSavedReportPayloadRecord !== 'function' || typeof api.getSeededSavedReportPayloads !== 'function' || typeof api.replaceSeededSavedReportPayloads !== 'function') { throw new Error('appendSeededSavedReportPayloadRecord API not available.'); } const existing = api.getSeededSavedReportPayloads(); const next = existing.filter((entry) => { const target = entry?.savedReportPayload || entry; return (target?.reportDocument?.id || '') !== 'authoredChannelChartQ3Preview'; }); api.replaceSeededSavedReportPayloads(next); const appended = api.appendSeededSavedReportPayloadRecord({ reportId: 'authoredChannelChartQ3Preview', title: 'Authored Channel Chart Preview', artifactId: 'authored_channel_chart_q3_preview', documentVersion: 12, savedAt: 9750, baseState: { selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['channelV2'], viewMode: 'chart', chartSpec: { title: 'Inventory · Top Channels', type: 'horizontal_bar', xField: 'channelV2', yFields: ['avails'] }, orderField: 'avails', orderDir: 'desc', pageSize: 50, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, binding: { mode: 'semantic', modelRef: 'model://example/performance/delivery@v1', entity: 'line_delivery', selectedDimensions: ['event_date', 'channel', 'country_code'], selectedMeasures: ['available_impressions'] }, reportDocumentBlocks: [{ id: 'channelDetailChart', kind: 'chartBlock', title: 'Channel Detail Chart', datasetRef: 'primary', chartSpec: { title: 'Channel Detail Chart', type: 'horizontal_bar', xField: 'channelV2', yFields: ['avails'] } }], reportDocumentLayout: { type: 'stack', items: [{ blockId: 'primaryBuilder' }, { blockId: 'channelDetailChart' }] } } }); return !!appended && appended.savedReportPayload?.reportDocument?.id === 'authoredChannelChartQ3Preview' && appended.documentVersion === 12; })()",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare list response",
    },
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response:",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "authoredChannelChartQ3Preview",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"authoredChannelChartQ3Preview\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Authored Channel Chart Preview",
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
      expression: "(() => { const panel = document.querySelector('[aria-label=\"Get ReportDocument response summary\"]'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('\"kind\": \"getReportDocumentResponse\"') && text.includes('\"title\": \"Authored Channel Chart Preview\"') && text.includes('\"documentVersion\": 12') && text.includes('\"title\": \"Channel Detail Chart\"') && text.includes('\"blockId\": \"channelDetailChart\"'); })()",
      timeoutMs: 60000,
    },
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Authored Channel Chart Preview",
      reportId: "authoredChannelChartQ3Preview",
      documentVersion: 12,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions[0] === 'channelV2' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Inventory · Top Channels' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); if (!root) { return false; } const panel = Array.from(root.querySelectorAll('.forge-report-runtime-chart-panel')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Channel Detail Chart')); return !!panel && panel.querySelectorAll('.recharts-rectangle, .recharts-bar-rectangle').length >= 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Channel Detail Chart')); if (!panel) { throw new Error('Channel Detail Chart runtime panel not found.'); } const mark = panel.querySelector('.recharts-rectangle, .recharts-bar-rectangle'); if (!mark) { throw new Error('Channel Detail Chart mark not found.'); } mark.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); mark.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Channel Detail Chart')); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('Display') && text.includes('Drill to Market'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const panel = Array.from(root?.querySelectorAll('.forge-report-runtime-chart-panel') || []).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Channel Detail Chart')); if (!panel) { throw new Error('Channel Detail Chart runtime panel not found.'); } const action = Array.from(panel.querySelectorAll('.forge-report-runtime-chart-action')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill to Market')); if (!action) { throw new Error('Channel Detail Chart drill action not found.'); } action.click(); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "Drill to Market = Display",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); return Array.from(root?.querySelectorAll('.forge-report-runtime-refinement-chip') || []).some((node) => (node.innerText || node.textContent || '').includes('Drill to Market = Display')); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const chips = Array.from(root?.querySelectorAll('.forge-report-runtime-refinement-chip') || []).map((node) => (node.innerText || node.textContent || '').trim()); if (!chips.some((entry) => entry.includes('Drill to Market = Display'))) { return false; } const panel = root?.querySelector('.forge-report-runtime-table-panel'); const headers = panel?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return labels.includes('Market') && !labels.includes('Channel'); })()",
      timeoutMs: 60000,
    },
    {
      type: "reload",
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Reopened ReportDocument: Authored Channel Chart Preview",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const interaction = preview?.getStandaloneRuntimeInteraction?.(); if (!interaction) { return false; } const root = Array.from(document.querySelectorAll('.forge-report-builder__runtime-preview')).find((node) => node && node.offsetParent !== null); const chips = Array.from(root?.querySelectorAll('.forge-report-runtime-refinement-chip') || []).map((node) => (node.innerText || node.textContent || '').trim()); const panel = root?.querySelector('.forge-report-runtime-table-panel'); const headers = panel?.querySelectorAll('th') || []; const labels = Array.from(headers).map((entry) => (entry.innerText || entry.textContent || '').trim()); return chips.some((entry) => entry.includes('Drill to Market = Display')) && labels.includes('Market') && !labels.includes('Channel') && Array.isArray(interaction.drillTransitions) && interaction.drillTransitions.some((entry) => entry.nextFieldRef === 'country'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-authored-chart-saved-record-drill.png",
      fullPage: true,
    },
  ],
};
