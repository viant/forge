import { buildPreviewBootstrapSteps, buildDrillNavigationProviderRoutePresetSelectionSteps } from "./report-builder-preview-scenario-builders.mjs";

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
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const config = preview && typeof preview.getBuilderConfig === 'function' ? preview.getBuilderConfig() : null; return !!config && Array.isArray(config.drillMetadata?.detailTargets) && config.drillMetadata.detailTargets.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['country'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; return !!state && Array.isArray(state.selectedDimensions) && state.selectedDimensions.join(',') === 'country' && Array.isArray(state.drillMetadata?.detailTargets) && state.drillMetadata.detailTargets.length === 0; })()",
      timeoutMs: 60000,
    },
    ...buildDrillNavigationProviderRoutePresetSelectionSteps({
      breakdownField: "country",
      targetRef: "target://example/performance/market-detail",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const labels = Array.from(drillPanel.querySelectorAll('label')); const byTitle = (title) => labels.find((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === title)); const targetInput = byTitle('Target reference')?.querySelector('input'); const titleInput = byTitle('Detail title')?.querySelector('input'); const parameterLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Parameter')); const valueSourceLabels = labels.filter((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim() === 'Value source')); return !!targetInput && targetInput.value === 'target://example/performance/market-detail' && !!titleInput && titleInput.value === 'Show market details' && parameterLabels.some((label) => (label.querySelector('input')?.value || '') === 'country') && valueSourceLabels.some((label) => (label.querySelector('select')?.value || '') === 'runtimeValue'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Add detail action' || text === 'Update detail action'; }); if (!button) { throw new Error('Detail target apply button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; if (!state) { return false; } const detailTarget = (state.drillMetadata?.detailTargets || []).find((entry) => entry.targetRef === 'target://example/performance/market-detail'); const fieldAction = (state.drillMetadata?.fieldActions || []).find((entry) => entry.fieldRef === 'country'); return !!detailTarget && !!fieldAction && detailTarget.parameters?.country === '$value' && Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/market-detail'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-table-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Show market details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-table-panel .forge-dashboard-row-action",
      text: "Show market details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-host-intent'); const text = panel?.innerText || panel?.textContent || ''; const parameterCount = panel?.querySelectorAll('.forge-report-runtime-host-intent__parameter')?.length || 0; return parameterCount === 1 && text.includes('target://example/performance/market-detail') && text.includes('country') && text.includes('US'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-provider-market-preset.png",
      fullPage: true,
    },
  ],
};
