import {
  buildDrillNavigationProviderRoutePresetSelectionSteps,
  buildPreviewBootstrapSteps,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderConfig !== 'function') { throw new Error('patchBuilderConfig API not available.'); } return !!preview.patchBuilderConfig({ drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()"
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()"
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; return !!state && Array.isArray(state.selectedDimensions) && state.selectedDimensions.join(',') === 'eventDate' && Array.isArray(state.drillMetadata?.hierarchies) && state.drillMetadata.hierarchies.length === 0 && Array.isArray(state.drillMetadata?.detailTargets) && state.drillMetadata.detailTargets.length === 0 && Array.isArray(state.drillMetadata?.fieldActions) && state.drillMetadata.fieldActions.length === 0; })()",
      timeoutMs: 60000
    },
    ...buildDrillNavigationProviderRoutePresetSelectionSteps({
      breakdownField: "eventDate",
      targetRef: "target://example/performance/date-detail",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const byTitle = (title) => labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === title)); const targetInput = byTitle('Target reference')?.querySelector('input'); const titleInput = byTitle('Detail title')?.querySelector('input'); const parameterLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Parameter')); const valueSourceLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Value source')); return !!targetInput && targetInput.value === 'target://example/performance/date-detail' && !!titleInput && titleInput.value === 'Show date details' && parameterLabels.some((label) => (label.querySelector('input')?.value || '') === 'eventDate') && valueSourceLabels.some((label) => (label.querySelector('select')?.value || '') === 'runtimeValue'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Add detail action' || text === 'Update detail action'; }); if (!button) { throw new Error('Detail target apply button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; if (!state) { return false; } const detailTarget = (state.drillMetadata?.detailTargets || []).find((entry) => entry.targetRef === 'target://example/performance/date-detail'); const fieldAction = (state.drillMetadata?.fieldActions || []).find((entry) => entry.fieldRef === 'eventDate'); return !!detailTarget && !!fieldAction && detailTarget.parameters?.eventDate === '$value' && Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/date-detail'); })()",
      timeoutMs: 60000
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-table-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Show date details'); })()",
      timeoutMs: 60000
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show date details",
      index: 0
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-host-intent'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('target://example/performance/date-detail') && text.includes('eventDate') && text.includes('2026-05-01'); })()",
      timeoutMs: 60000
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-provider-date-preset.png",
      fullPage: true
    }
  ]
}
