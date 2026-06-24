import {
  buildClearDetailTargetBehaviorsSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildSavedPayloadPreparationSteps,
  buildRuntimeResolvedDetailTargetWaitSteps,
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
      type: "waitForEval",
      expression: "!((document.body?.innerText || document.body?.textContent || '').includes('Local Draft'))",
      timeoutMs: 5000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "waitForEval",
      expression: "Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim().includes('Reach Rate')))",
      timeoutMs: 60000,
    },
    ...buildSavedPayloadPreparationSteps({
      documentVersion: "11",
      draftTriggerText: "Reach Rate",
    }),
    {
      type: "waitForDomContains",
      text: "List ReportDocuments response: 7 entries",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "capacityTrendQ3",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get request",
    },
    {
      type: "waitForDomContains",
      text: "\"reportId\": \"capacityTrendQ3\"",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity Trend Q3",
      timeoutMs: 60000,
    },
    {
      type: "waitForDomContains",
      text: "\"documentVersion\": 6",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && window.__REPORT_BUILDER_PREVIEW__.replaceDetailTargetBehaviors && window.__REPORT_BUILDER_PREVIEW__.replaceDetailTargetBehaviors([{ match: { targetRef: 'target://example/performance/channel-detail' }, result: { detailTarget: null } }]);",
    },
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
      reportTitle: "Capacity Trend Q3",
      reportId: "capacityTrendQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "window.__REPORT_BUILDER_PREVIEW__ && typeof window.__REPORT_BUILDER_PREVIEW__.getBuilderState === 'function' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.viewMode === 'chart' && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedDimensions) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.length === 2 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('eventDate') && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedDimensions.includes('channelV2') && Array.isArray(window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.selectedMeasures) && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures.length === 1 && window.__REPORT_BUILDER_PREVIEW__.getBuilderState().selectedMeasures[0] === 'avails' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.title === 'Avails by Date and Channel' && window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.chartSpec?.type === 'area' && !window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelectorAll('.forge-report-runtime-chart-panel .forge-chart-legend-action').length >= 2",
      timeoutMs: 60000,
    },
    {
      type: "clickSelector",
      selector: ".forge-report-runtime-chart-panel .forge-chart-legend-action",
      index: 0,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-runtime-chart-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('Display'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-runtime-chart-action",
      text: "Show channel details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Runtime Diagnostics",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Resolved detail target') && text.includes('target://example/performance/channel-detail') && text.includes('Display') && text.includes('Detail target resolved with omitted parameters:') && text.includes('Runtime Diagnostics') && document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel') != null; })()",
      timeoutMs: 60000,
    },
    {
      type: "waitForEval",
      expression: "document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') != null",
      timeoutMs: 60000,
    },
    ...buildClearDetailTargetBehaviorsSteps(),
    {
      type: "clickSelector",
      selector: ".forge-report-builder__runtime-preview .forge-chart-legend-action",
      index: 1,
    },
    {
      type: "waitForEval",
      expression: "(() => { const panel = document.querySelector('.forge-report-builder__runtime-preview .forge-report-runtime-chart-panel'); const text = panel?.innerText || panel?.textContent || ''; return text.includes('Selected value:') && text.includes('CTV'); })()",
      timeoutMs: 60000,
    },
    {
      type: "clickSelectorContains",
      selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action",
      text: "Show channel details",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Resolved detail target",
      timeoutMs: 60000,
    },
    ...buildRuntimeResolvedDetailTargetWaitSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      expectedTexts: [
        "target://example/performance/channel-detail",
        "CTV",
      ],
      forbiddenTexts: [
        "missing-channel-detail",
      ],
      requireHostIntent: true,
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-reopen-report-document-chart-detail-recovery.png",
      fullPage: true,
    },
  ],
};
