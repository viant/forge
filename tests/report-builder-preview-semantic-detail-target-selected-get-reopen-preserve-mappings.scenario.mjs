import {
  buildAuthoredDetailTargetRestorationWaitStep,
  buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeDetailTargetResolutionSteps,
  buildTemporaryDetailTargetMutationSteps,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails'], primaryMeasure: 'avails', selectedDimensions: ['eventDate', 'channelV2'], viewMode: 'table', chartSpec: null, staticFilters: { dateRange: { start: '2026-05-01', end: '2026-05-04' } }, drillMetadata: { detailTargets: [ { targetRef: 'target://example/performance/channel-detail-modal', navigationMode: 'modal', title: 'Archived Channel detail', description: 'Open the archived channel detail route.', parameters: { channel: '$value', eventDate: '$row.eventDate', source: 'archived' } } ], fieldActions: [ { fieldRef: 'channelV2', actions: [ { id: 'detail:channelV2:target:_example_performance_channel-detail-modal', label: 'Show Channel details', kind: 'detail', targetRef: 'target://example/performance/channel-detail-modal' } ] } ] } }); })()",
    },
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
      value: "23",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 23.",
      timeoutMs: 60000,
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
      type: "waitForEval",
      expression: "(() => { const select = document.querySelector('select[aria-label=\"List response entry\"]'); return !!select && Array.from(select.options).some((option) => option.value === 'demoReportBuilder'); })()",
      timeoutMs: 60000,
    },
    {
      type: "selectSelector",
      selector: "select[aria-label=\"List response entry\"]",
      value: "demoReportBuilder",
    },
    {
      type: "waitForDomContains",
      text: "Selected entry: Report Builder Demo",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare selected get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Report Builder Demo",
      timeoutMs: 60000,
    },
    ...buildTemporaryDetailTargetMutationSteps({
      temporaryTargetRef: "target://example/performance/channel-detail",
      authoredTargetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
    }),
    ...buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
      runtimePanelSelector: ".forge-report-runtime-table-panel",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 23,
    }),
    buildAuthoredDetailTargetRestorationWaitStep({
      targetRef: "target://example/performance/channel-detail-modal",
      fieldRef: "channelV2",
      parameters: {
        channel: "$value",
        eventDate: "$row.eventDate",
        source: "archived",
      },
      requireFieldAction: true,
    }),
    ...buildRuntimeDetailTargetResolutionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show Channel details",
      expectedTexts: [
        "target://example/performance/channel-detail-modal",
        "modal",
        "Display",
        "eventDate",
        "2026-05-01",
        "source",
        "archived",
      ],
      forbiddenTexts: [
        "Detail target resolved with omitted parameters: channel.",
        "No detail target resolved",
        "Failed to resolve detail target",
      ],
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-selected-get-reopen-preserve-mappings.png",
      fullPage: true,
    },
  ],
};
