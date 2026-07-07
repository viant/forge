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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderConfig !== 'function') { throw new Error('patchBuilderConfig API not available.'); } return !!preview.patchBuilderConfig({ drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const config = preview && typeof preview.getBuilderConfig === 'function' ? preview.getBuilderConfig() : null; return !!config && Array.isArray(config.drillMetadata?.hierarchies) && config.drillMetadata.hierarchies.length === 0 && Array.isArray(config.drillMetadata?.detailTargets) && config.drillMetadata.detailTargets.length === 0 && Array.isArray(config.drillMetadata?.fieldActions) && config.drillMetadata.fieldActions.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate', 'channelV2'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; return !!state && state?.binding?.mode === 'semantic' && Array.isArray(state.selectedDimensions) && state.selectedDimensions.join(',') === 'eventDate,channelV2' && Array.isArray(state.drillMetadata?.hierarchies) && state.drillMetadata.hierarchies.length === 0 && Array.isArray(state.drillMetadata?.detailTargets) && state.drillMetadata.detailTargets.length === 0 && Array.isArray(state.drillMetadata?.fieldActions) && state.drillMetadata.fieldActions.length === 0; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "Semantic binding: Ad Delivery • Entity: Line Delivery",
      timeoutMs: 60000,
    },
    ...buildDrillNavigationProviderRoutePresetSelectionSteps({
      breakdownField: "channelV2",
      targetRef: "target://example/performance/channel-detail",
    }),
    {
      type: "waitForEval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { return false; } const text = drillPanel.innerText || drillPanel.textContent || ''; const labels = Array.from(drillPanel.querySelectorAll('label')); const fieldNames = labels.map((label) => ((label.querySelector('span')?.innerText || label.querySelector('span')?.textContent || '').trim())); return text.includes('Current path:') && text.includes('Delivery Date') && text.includes('Channel') && fieldNames.includes('Breakdown field') && fieldNames.includes('Route preset') && fieldNames.includes('Target reference') && fieldNames.includes('Detail title') && fieldNames.includes('Description') && fieldNames.includes('Parameter') && fieldNames.includes('Value source'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); if (!drillPanel) { throw new Error('Drill navigation panel not found.'); } const button = Array.from(drillPanel.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Capture current path' || text === 'Update current path'; }); if (!button) { throw new Error('Capture current path button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.(); return !!state && Array.isArray(state.drillMetadata?.hierarchies) && state.drillMetadata.hierarchies.length === 1 && state.drillMetadata.hierarchies[0]?.id === 'eventDate__channelV2'; })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => { const text = (entry.innerText || entry.textContent || '').trim(); return text === 'Add detail action' || text === 'Update detail action'; }); if (!button) { throw new Error('Detail target apply button not found.'); } button.click(); return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; if (!state) { return false; } const detailTarget = (state.drillMetadata?.detailTargets || []).find((entry) => entry.targetRef === 'target://example/performance/channel-detail'); const fieldAction = (state.drillMetadata?.fieldActions || []).find((entry) => entry.fieldRef === 'channelV2'); return !!detailTarget && !!fieldAction && detailTarget.parameters?.channel === '$value' && detailTarget.parameters?.campaign === '$row.campaign' && Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/channel-detail'); })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-table-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Show Channel details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const moveLeft = document.querySelector('.forge-report-builder__left-resizer-step[aria-label=\"Move divider left\"]'); if (!rail || !moveLeft) { throw new Error('Left rail move-left control not found.'); } window.__REPORT_BUILDER_DRILL_RAIL_WIDTH_BEFORE__ = Math.round(rail.getBoundingClientRect().width); for (let index = 0; index < 8; index += 1) { if (moveLeft.disabled) { break; } moveLeft.click(); } return true; })()",
    },
    {
      type: "waitForEval",
      expression: "(() => { const rail = document.querySelector('.forge-report-builder__left'); const drillPanel = Array.from(document.querySelectorAll('.forge-report-builder__chart-inline-notice')).find((entry) => ((entry.innerText || entry.textContent || '')).includes('Drill navigation')); const moveLeft = document.querySelector('.forge-report-builder__left-resizer-step[aria-label=\"Move divider left\"]'); const runtimePanel = document.querySelector('.forge-report-runtime-table-panel'); if (!rail || !drillPanel || !moveLeft || !runtimePanel) { return false; } const before = Number(window.__REPORT_BUILDER_DRILL_RAIL_WIDTH_BEFORE__ || 0); const railWidth = Math.round(rail.getBoundingClientRect().width); const panelRect = drillPanel.getBoundingClientRect(); const interactive = Array.from(drillPanel.querySelectorAll('button, input, select')).filter((entry) => entry.offsetParent !== null); const insideBounds = interactive.every((entry) => { const rect = entry.getBoundingClientRect(); return rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1; }); const panelText = drillPanel.innerText || drillPanel.textContent || ''; const bodyText = document.body?.innerText || document.body?.textContent || ''; const runtimeText = runtimePanel.innerText || runtimePanel.textContent || ''; return before > 0 && railWidth <= before - 24 && moveLeft.disabled === true && rail.scrollWidth <= rail.clientWidth + 1 && drillPanel.scrollWidth <= drillPanel.clientWidth + 1 && insideBounds && panelText.includes('Current path:') && panelText.includes('Show Channel details') && bodyText.includes('Semantic binding: Ad Delivery • Entity: Line Delivery') && runtimeText.includes('Show Channel details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-left-rail-drill-runtime-layout.png",
      fullPage: true,
    },
  ],
};
