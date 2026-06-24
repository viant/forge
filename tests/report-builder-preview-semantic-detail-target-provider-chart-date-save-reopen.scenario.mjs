import {
  buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps,
  buildPreviewBootstrapSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartDetailTargetResolutionSteps,
  buildRuntimeHostIntentDismissSteps,
  buildStandaloneRuntimeChartDetailTargetResolutionSteps,
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
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.patchBuilderState !== 'function') { throw new Error('patchBuilderState API not available.'); } return !!preview.patchBuilderState({ selectedMeasures: ['avails', 'hhUniqs'], primaryMeasure: 'avails', selectedDimensions: ['eventDate'], viewMode: 'chart', drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] } }); })()",
    },
    {
      type: "clickSelector",
      selector: ".forge-report-builder__chart-action-button--quick",
    },
    {
      type: "clickSelectorContains",
      selector: "[role=\"menuitem\"]",
      text: "Avails + HH Uniques by Date",
      index: 0,
    },
    {
      type: "waitForDomContains",
      text: "Avails + HH Uniques by Date",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.replaceCollectionRows !== 'function') { throw new Error('Preview replaceCollectionRows API not available.'); } preview.replaceCollectionRows([{ eventDate: '2026-05-01', avails: 40000, hhUniqs: 16000, country: 'US' }, { eventDate: '2026-05-01', avails: 34700, hhUniqs: 15200, country: 'US' }, { eventDate: '2026-05-02', avails: 42000, hhUniqs: 17000, country: 'US' }, { eventDate: '2026-05-02', avails: 36400, hhUniqs: 15600, country: 'US' }, { eventDate: '2026-05-03', avails: 36000, hhUniqs: 14800, country: 'CA' }, { eventDate: '2026-05-03', avails: 33700, hhUniqs: 14200, country: 'CA' }, { eventDate: '2026-05-04', avails: 38000, hhUniqs: 15500, country: 'CA' }, { eventDate: '2026-05-04', avails: 35800, hhUniqs: 14900, country: 'CA' }], { hasMore: false, error: null }); return true; })()",
    },
    {
      type: "waitForDomContains",
      text: "34.7K",
      timeoutMs: 60000,
    },
    {
      type: "eval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; if (!preview || typeof preview.beginStandaloneDraft !== 'function') { throw new Error('beginStandaloneDraft API not available.'); } return !!preview.beginStandaloneDraft({ sourceLabel: 'provider chart date flow', patch: { __scenarioProviderChartDateDraft: true } }); })()",
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
      value: "41",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 41.",
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
    ...buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
      runtimePanelSelector: ".forge-report-runtime-chart-panel",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Report Builder Demo",
      reportId: "demoReportBuilder",
      documentVersion: 41,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const state = window.__REPORT_BUILDER_PREVIEW__?.getBuilderState?.() || null; const detailTarget = Array.isArray(state?.drillMetadata?.detailTargets) ? state.drillMetadata.detailTargets.find((entry) => entry.targetRef === 'target://example/performance/date-detail') : null; const fieldAction = Array.isArray(state?.drillMetadata?.fieldActions) ? state.drillMetadata.fieldActions.find((entry) => entry.fieldRef === 'eventDate') : null; return !!detailTarget && !!fieldAction && detailTarget.parameters?.eventDate === '$value' && Array.isArray(fieldAction.actions) && fieldAction.actions.some((entry) => entry.targetRef === 'target://example/performance/date-detail'); })()",
      timeoutMs: 60000,
    },
    ...buildRuntimeChartDetailTargetResolutionSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      actionText: "Show date details",
      selectedValueTexts: ["Selected value:", "2026-05-01"],
      expectedTexts: [
        "target://example/performance/date-detail",
        "eventDate",
        "2026-05-01",
        "country",
        "US",
      ],
      forbiddenTexts: [
        "Detail target resolved with omitted parameters: country.",
        "No detail target resolved",
        "Failed to resolve detail target",
      ],
    }),
    ...buildRuntimeHostIntentDismissSteps({
      runtimeScopeSelector: ".forge-report-builder__runtime-preview",
      missingButtonMessage: "Preview dismiss intent button not found.",
    }),
    ...buildStandaloneRuntimeChartDetailTargetResolutionSteps({
      actionText: "Show date details",
      selectedValueTexts: ["Selected value:", "2026-05-01"],
      expectedTexts: [
        "target://example/performance/date-detail",
        "eventDate",
        "2026-05-01",
        "country",
        "US",
      ],
      forbiddenTexts: [
        "Detail target resolved with omitted parameters: country.",
        "No detail target resolved",
        "Failed to resolve detail target",
      ],
      missingMarkMessage: "Reopened standalone runtime chart mark not found.",
      missingActionMessage: "Reopened standalone runtime Show date details action not found.",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-detail-target-provider-chart-date-save-reopen.png",
      fullPage: true,
    },
  ],
};
