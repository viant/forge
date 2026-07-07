import {
  buildAuthoredRuntimeSemanticSurfaceWaitStep,
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
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.patchBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate'], chartSpec: { title: 'Avails by Date', type: 'bar', xField: 'eventDate', yFields: ['avails'] }, viewMode: 'chart', staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } } })",
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'chartBlock', fieldRef: 'eventDate' }, delayMs: 200, error: 'Preview runtime action provider failed.' }])",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Run",
      exact: true,
    },
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Failed to load refinement actions for Delivery Date.') && text.includes('Preview runtime action provider failed.'); })()",
      timeoutMs: 60000,
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date",
      measureText: "Measures Available Impressions",
    }),
    {
      type: "waitForDomContains",
      text: "Retry action provider",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceRuntimeActionBehaviors([{ match: { blockKind: 'chartBlock', fieldRef: 'eventDate' }, delayMs: 1200, actions: [{ id: 'detail_date', label: 'Show date details', kind: 'detail', targetRef: 'target://example/performance/date-detail' }] }])",
    },
    {
      type: "clickRole",
      role: "button",
      name: "Retry action provider",
      exact: true,
    },
    {
      type: "waitForDomContains",
      text: "Retrying action provider",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return !text.includes('Preview runtime action provider failed.') && !text.includes('Failed to load refinement actions for Delivery Date.'); })()",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Runtime Diagnostics",
    },
    buildAuthoredRuntimeSemanticSurfaceWaitStep({
      dimensionText: "Dimensions Delivery Date",
      measureText: "Measures Available Impressions",
    }),
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle').length > 0",
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value: 2026-05-01') && text.includes('Show date details'); })()",
      timeoutMs: 60000,
    },
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-runtime-action-provider-retry.png",
      fullPage: true,
    },
  ],
};
