import { buildPreviewBootstrapSteps } from "./report-builder-preview-scenario-builders.mjs";

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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate', 'channelV2'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { detailTargets: [ { targetRef: 'target://example/performance/channel-detail', navigationMode: 'hostRoute', title: 'Channel detail', description: 'Open the selected channel detail route.', parameters: { channel: '$value', eventDate: '$row.eventDate' } }, { targetRef: 'target://example/performance/channel-detail-modal', navigationMode: 'modal', title: 'Archived Channel detail', description: 'Open the archived channel detail route.', parameters: { channel: '$value', eventDate: '$row.eventDate', source: 'archived' } } ], fieldActions: [ { fieldRef: 'channelV2', actions: [ { id: 'detail:channelV2:target:_example_performance_channel-detail', label: 'Show Channel details', kind: 'detail', targetRef: 'target://example/performance/channel-detail' } ] } ] } }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; return !!state && Array.isArray(state.selectedDimensions) && state.selectedDimensions.join(',') === 'eventDate,channelV2' && Array.isArray(state.drillMetadata?.detailTargets) && state.drillMetadata.detailTargets.length === 2 && Array.isArray(state.drillMetadata?.fieldActions) && state.drillMetadata.fieldActions.length === 1; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const editButton = Array.from(drillPanel.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Edit') && (entry.parentElement?.innerText || entry.closest('div')?.innerText || '').includes('Show Channel details')); if (!editButton) { throw new Error('Detail action edit button not found.'); } editButton.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const byTitle = (title) => labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === title)); const targetInput = byTitle('Target reference')?.querySelector('input'); const navigationMode = byTitle('Navigation mode')?.querySelector('select'); const titleInput = byTitle('Detail title')?.querySelector('input'); const parameterLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Parameter')); return !!targetInput && targetInput.value === 'target://example/performance/channel-detail' && !!navigationMode && navigationMode.value === 'hostRoute' && !!titleInput && titleInput.value === 'Channel detail' && parameterLabels.length >= 2; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const labels = Array.from(drillPanel.querySelectorAll('label')); const routePresetLabel = labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Route preset')); const routePreset = routePresetLabel?.querySelector('select'); if (!routePreset) { throw new Error('Route preset select not found.'); } routePreset.value = 'target://example/performance/channel-detail-modal'; routePreset.dispatchEvent(new Event('change', { bubbles: true })); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const byTitle = (title) => labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === title)); const targetInput = byTitle('Target reference')?.querySelector('input'); const navigationMode = byTitle('Navigation mode')?.querySelector('select'); const titleInput = byTitle('Detail title')?.querySelector('input'); const descriptionInput = byTitle('Description')?.querySelector('input'); const parameterLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Parameter')); const valueSourceLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Value source')); const literalLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Literal value')); const parameterValues = parameterLabels.map((label) => label.querySelector('input')?.value || ''); const valueSourceValues = valueSourceLabels.map((label) => label.querySelector('select')?.value || ''); const literalValues = literalLabels.map((label) => label.querySelector('input')?.value || ''); return !!targetInput && targetInput.value === 'target://example/performance/channel-detail-modal' && !!navigationMode && navigationMode.value === 'modal' && !!titleInput && titleInput.value === 'Archived Channel detail' && !!descriptionInput && descriptionInput.value === 'Open the archived channel detail route.' && parameterValues.includes('source') && valueSourceValues.includes('literal') && literalValues.includes('archived'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Add detail action' || text === 'Update detail action'; }); if (!button) { throw new Error('Detail target apply button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; if (!state) { return false; } const fieldAction = (state.drillMetadata?.fieldActions || []).find((entry) => entry.fieldRef === 'channelV2'); const detailAction = fieldAction && Array.isArray(fieldAction.actions) ? fieldAction.actions.find((entry) => entry.targetRef === 'target://example/performance/channel-detail-modal') : null; const detailTarget = (state.drillMetadata?.detailTargets || []).find((entry) => entry.targetRef === 'target://example/performance/channel-detail-modal'); return !!detailAction && !!detailTarget && detailTarget.navigationMode === 'modal' && detailTarget.title === 'Archived Channel detail' && detailTarget.parameters?.channel === '$value' && detailTarget.parameters?.eventDate === '$row.eventDate' && detailTarget.parameters?.source === 'archived' && !(Array.isArray(fieldAction?.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/channel-detail')); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-table-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Show Channel details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
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
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-host-intent'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('target://example/performance/channel-detail-modal') && text.includes('modal') && text.includes('channel') && text.includes('Display') && text.includes('eventDate') && text.includes('2026-05-01') && text.includes('source') && text.includes('archived'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-edit-preserve-mappings.png",
      fullPage: true,
    },
  ],
};
