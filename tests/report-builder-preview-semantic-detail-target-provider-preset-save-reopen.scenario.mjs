import {
  buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderConfig !== 'function') { throw new Error('patchBuilderConfig API not available.'); } return !!preview.patchBuilderConfig({ drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate', 'channelV2'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "eval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const labels = Array.from(drillPanel.querySelectorAll('label')); const breakdownLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Breakdown field')); const breakdownSelect = breakdownLabel?.querySelector('select'); if (!breakdownSelect) { throw new Error('Breakdown field select not found.'); } breakdownSelect.value = 'channelV2'; breakdownSelect.dispatchEvent(new Event('change', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const routePresetLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Route preset')); const routePreset = routePresetLabel?.querySelector('select'); if (!routePreset) { return false; } return Array.from(routePreset.options).some((option) => option.value === 'target://example/performance/channel-detail'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const labels = Array.from(drillPanel.querySelectorAll('label')); const routePresetLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Route preset')); const routePreset = routePresetLabel?.querySelector('select'); if (!routePreset) { throw new Error('Route preset select not found.'); } routePreset.value = 'target://example/performance/channel-detail'; routePreset.dispatchEvent(new Event('change', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const byTitle = (title) => labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === title)); const targetInput = byTitle('Target reference')?.querySelector('input'); const titleInput = byTitle('Detail title')?.querySelector('input'); const parameterLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Parameter')); return !!targetInput && targetInput.value === 'target://example/performance/channel-detail' && !!titleInput && titleInput.value === 'Show channel details' && parameterLabels.some((label) => (label.querySelector('input')?.value || '') === 'campaign'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Add detail action' || text === 'Update detail action'; }); if (!button) { throw new Error('Detail target apply button not found.'); } button.click(); return true; })()",
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('beginStandaloneDraft API not available.'); } return !!preview.beginStandaloneDraft({ sourceLabel: 'provider preset semantic flow', patch: { __scenarioProviderPresetDraft: true } }); })()",
    },
    {
      type: "waitForDomContains",
      text: "Local Draft",
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
      value: "31",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 31.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; const detailTarget = Array.isArray(state?.drillMetadata?.detailTargets) ? state.drillMetadata.detailTargets.find((entry) => entry.targetRef === 'target://example/performance/channel-detail') : null; return !!detailTarget && detailTarget.parameters?.campaign === '$row.campaign'; })()",
      timeoutMs: 60000,
    },
    ...buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
      runtimePanelSelector: ".forge-report-runtime-table-panel",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 31,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; const detailTarget = Array.isArray(state?.drillMetadata?.detailTargets) ? state.drillMetadata.detailTargets.find((entry) => entry.targetRef === 'target://example/performance/channel-detail') : null; const fieldAction = Array.isArray(state?.drillMetadata?.fieldActions) ? state.drillMetadata.fieldActions.find((entry) => entry.fieldRef === 'channelV2') : null; return !!detailTarget && !!fieldAction && detailTarget.parameters?.channel === '$value' && detailTarget.parameters?.campaign === '$row.campaign' && Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/channel-detail'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action').length >= 1",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show Channel details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent'); const runtimeText = document.querySelector('.forge-report-builder__runtime-preview')?.innerText || ''; const text = panel?.innerText || panel?.textContent || ''; return text.includes('target://example/performance/channel-detail') && text.includes('Display') && text.includes('campaign') && text.includes('Prospect Sprint') && !runtimeText.includes('Detail target resolved with omitted parameters: channel.') && !runtimeText.includes('No detail target resolved') && !runtimeText.includes('Failed to resolve detail target'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-provider-preset-save-reopen.png",
      fullPage: true,
    },
  ],
};
