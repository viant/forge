import {
  buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildRuntimeChartDetailTargetResolutionSteps,
  buildRuntimeHostIntentDismissSteps,
  buildSeededSavedPayloadArtifactImportSteps,
  buildStandaloneRuntimeChartDetailTargetResolutionSteps,
} from "./report-builder-preview-scenario-builders.mjs";

const clearedDrillMetadataExpression = "{ hierarchies: [], detailTargets: [], fieldActions: [] }";

export default {
  baseUrl: "http://127.0.0.1:5175",
  viewport: {
    width: 1280,
    height: 960,
  },
  steps: [
    ...buildSeededSavedPayloadArtifactImportSteps({
      reportId: "capacityKpiBlendByDateQ3",
      artifactExpression: `{ ...payload, reportDocument: { ...payload.reportDocument, blocks: (Array.isArray(payload.reportDocument?.blocks) ? payload.reportDocument.blocks : []).map((block) => (block?.id === 'primaryBuilder' ? { ...block, config: { ...(block.config || {}), drillMetadata: ${clearedDrillMetadataExpression} }, state: { ...(block.state || {}), drillMetadata: ${clearedDrillMetadataExpression} } } : block)) }, reportSpec: { ...(payload.reportSpec || {}), drillMetadata: ${clearedDrillMetadataExpression} } }`,
      filename: "capacity-kpi-blend-provider-date.saved-report-payload.json",
      missingArtifactMessage: "seeded provider-backed capacity saved report payload not found",
      importedNoticeText: "Imported saved report payload Capacity KPI Blend Q3.",
    }),
    {
      type: "waitForDomContains",
      text: "Saved report payload: Capacity KPI Blend Q3",
      timeoutMs: 60000,
    },
    {
      type: "assertDomNotContains",
      text: "Local Draft",
    },
    {
      type: "fillSelector",
      selector: "input[aria-label=\"Document version\"]",
      value: "11",
    },
    {
      type: "waitForDomContains",
      text: "Using document version 11.",
      timeoutMs: 60000,
    },
    {
      type: "clickRole",
      role: "button",
      name: "Prepare get response",
    },
    {
      type: "waitForDomContains",
      text: "Get ReportDocument response: Capacity KPI Blend Q3",
      timeoutMs: 60000,
    },
    ...buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
      runtimePanelSelector: ".forge-report-runtime-chart-panel",
    }),
    ...buildReopenedHydratedSessionVerificationSteps({
      reportTitle: "Capacity KPI Blend Q3",
      reportId: "capacityKpiBlendByDateQ3",
      documentVersion: 11,
      includeSummaryNotice: true,
    }),
    {
      type: "waitForEval",
      expression: "(() => { const preview = window.__REPORT_BUILDER_PREVIEW__; const state = preview && typeof preview.getBuilderState === 'function' ? preview.getBuilderState() : null; const config = preview && typeof preview.getBuilderConfig === 'function' ? preview.getBuilderConfig() : null; return !!state && !!config && state?.viewMode === 'chart' && state?.chartSpec?.title === 'Avails + HH Uniques by Date' && state?.chartSpec?.type === 'bar' && Array.isArray(state?.selectedDimensions) && state.selectedDimensions.length === 1 && state.selectedDimensions[0] === 'eventDate' && Array.isArray(state?.selectedMeasures) && state.selectedMeasures.length === 2 && state.selectedMeasures.includes('avails') && state.selectedMeasures.includes('hhUniqs') && Array.isArray(state?.drillMetadata?.detailTargets) && state.drillMetadata.detailTargets.length === 0 && Array.isArray(state?.drillMetadata?.fieldActions) && state.drillMetadata.fieldActions.length === 0 && Array.isArray(config?.drillMetadata?.detailTargets) && config.drillMetadata.detailTargets.length === 0 && Array.isArray(config?.drillMetadata?.fieldActions) && config.drillMetadata.fieldActions.length === 0; })()",
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
      missingMarkMessage: "Imported reopened standalone runtime chart mark not found.",
      missingActionMessage: "Imported reopened standalone Show date details action not found.",
    }),
    {
      type: "screenshot",
      file: "report-builder-preview-semantic-import-provider-chart-date-save-reopen.png",
      fullPage: true,
    },
  ],
};
