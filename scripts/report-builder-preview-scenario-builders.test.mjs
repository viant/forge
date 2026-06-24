import assert from "node:assert/strict";

import {
  buildAriaSectionButtonClickStep,
  buildAudienceArtifactInspectionSteps,
  buildAudienceDefinitionRefWaitSteps,
  buildAudienceReopenVerificationSteps,
  buildAudienceSemanticBindingWaitStep,
  buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps,
  buildDrillNavigationProviderRoutePresetSelectionSteps,
  buildDetailTargetBehaviorInjectionSteps,
  buildDetailTargetBehaviorNullResultSteps,
  buildImportedFixtureArtifactSteps,
  buildInlineArtifactImportSteps,
  buildImportedListEntryFixturePreparationSteps,
  buildReopenedHydratedSessionVerificationSteps,
  buildReopenedExportInspectionSteps,
  buildRuntimeDetailTargetFailureSteps,
  buildRuntimeDetailTargetResolutionSteps,
  buildRuntimeChartDetailTargetFailureSteps,
  buildRuntimeChartDetailTargetResolutionSteps,
  buildRuntimeChartActionSelectionSteps,
  buildRuntimeHostIntentDismissSteps,
  buildRuntimeResolvedDetailTargetWaitSteps,
  buildSavedPayloadPreparationSteps,
  buildSemanticValidationBehaviorInjectionSteps,
  buildQueuedSemanticValidationBehaviorsStep,
  buildPreviewFetchBehaviorReplacementStep,
  buildPreviewLifecycleBehaviorReplacementStep,
  buildPreviewPatchBuilderStateStep,
  buildPreviewPatchBuilderConfigStep,
  buildSeededSavedPayloadCompileStatePatchSteps,
  buildSeededSavedPayloadArtifactImportSteps,
  buildSectionButtonClickStep,
  buildClearSemanticValidationBehaviorsStep,
  buildStandaloneRuntimeChartDetailTargetResolutionSteps,
  buildSelectedListEntryExportButtonStep,
  buildTemporaryDetailTargetMutationSteps,
  buildTitledCardButtonClickStep,
  buildAuthoredDetailTargetRestorationWaitStep,
  buildClearDetailTargetBehaviorsSteps,
  buildChartQueryBaselineResetSteps,
  buildChartQueryBaselineStableWaitStep,
  buildReopenedCompileDiagnosticsWaitSteps,
} from "../tests/report-builder-preview-scenario-builders.mjs";

assert.throws(
  () => buildSavedPayloadPreparationSteps(),
  /requires draftTriggerText/i,
);

const steps = buildSavedPayloadPreparationSteps({
  documentVersion: "17",
  draftTriggerText: "CTR",
});

assert.equal(steps.length, 12);

assert.deepEqual(steps.slice(0, 5), [
  {
    type: "waitForEval",
    expression: "(() => Array.from(document.querySelectorAll('.forge-report-builder__measure-pill')).some((entry) => ((entry.innerText || entry.textContent || '').trim() === \"CTR\")) )()",
    timeoutMs: 60000,
  },
  {
    type: "clickSelectorContains",
    selector: ".forge-report-builder__measure-pill",
    text: "CTR",
    index: 0,
  },
  {
    type: "waitForDomContains",
    text: "Local Draft",
    timeoutMs: 60000,
  },
  {
    type: "waitForEval",
    expression: "(() => { const button = Array.from(document.querySelectorAll('button')).find((entry) => ((entry.innerText || entry.textContent || '').trim() === 'Save artifact')); return !!button && !button.disabled && button.getAttribute('aria-disabled') !== 'true'; })()",
    timeoutMs: 60000,
  },
  {
    type: "clickRole",
    role: "button",
    name: "Save artifact",
  },
]);

assert.deepEqual(steps.slice(5), [
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
    value: "17",
  },
  {
    type: "waitForDomContains",
    text: "Using document version 17.",
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
]);

const trimmedSteps = buildSavedPayloadPreparationSteps({
  draftTriggerText: " CTR ",
});

assert.match(trimmedSteps[0].expression, /"CTR"/);
assert.equal(trimmedSteps[1].text, "CTR");

assert.deepEqual(steps[8], {
  type: "fillSelector",
  selector: "input[aria-label=\"Document version\"]",
  value: "17",
});

assert.throws(
  () => buildSeededSavedPayloadCompileStatePatchSteps(),
  /requires reportId and compileState/i,
);

assert.throws(
  () => buildSeededSavedPayloadCompileStatePatchSteps({
    reportId: "capacityTrendQ3",
    compileState: { diagnostics: [] },
  }),
  /requires expectedStatus/i,
);

const seededSavedPayloadCompileStatePatchSteps = buildSeededSavedPayloadCompileStatePatchSteps({
  reportId: "capacityTrendQ3",
  compileState: {
    status: "invalid",
    diagnostics: [
      {
        code: "documentBlockChartInvalid",
        message: "Primary Chart is no longer compatible with the current builder selection.",
      },
    ],
  },
  statusText: "INVALID",
});
assert.equal(seededSavedPayloadCompileStatePatchSteps.length, 2);
assert.match(seededSavedPayloadCompileStatePatchSteps[0].expression, /patchSeededSavedReportPayload/);
assert.match(seededSavedPayloadCompileStatePatchSteps[0].expression, /capacityTrendQ3/);
assert.match(seededSavedPayloadCompileStatePatchSteps[0].expression, /documentBlockChartInvalid/);
assert.match(seededSavedPayloadCompileStatePatchSteps[0].expression, /compileState\.status === "invalid"/);
assert.deepEqual(seededSavedPayloadCompileStatePatchSteps[1], {
  type: "waitForDomContains",
  text: "INVALID",
  timeoutMs: 60000,
});

assert.throws(
  () => buildSemanticValidationBehaviorInjectionSteps(),
  /requires match/i,
);

assert.throws(
  () => buildSemanticValidationBehaviorInjectionSteps({
    match: { entity: "line_delivery" },
    delayMs: 0,
  }),
  /requires errorMessage, result, or delayMs > 0/i,
);

const semanticValidationDelayOnlyStep = buildSemanticValidationBehaviorInjectionSteps({
  match: {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
  },
  delayMs: 1500,
});
assert.equal(semanticValidationDelayOnlyStep.type, "eval");
assert.match(semanticValidationDelayOnlyStep.expression, /replaceSemanticValidationBehaviors/);
assert.match(semanticValidationDelayOnlyStep.expression, /replaceSemanticValidationBehaviors API not available/);
assert.match(semanticValidationDelayOnlyStep.expression, /"delayMs":1500/);

const semanticValidationBehaviorInjectionStep = buildSemanticValidationBehaviorInjectionSteps({
  match: {
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    dimensions: ["event_date", "channel"],
    measures: ["available_impressions"],
  },
  errorMessage: "Semantic provider unavailable.",
});
assert.equal(semanticValidationBehaviorInjectionStep.type, "eval");
assert.match(semanticValidationBehaviorInjectionStep.expression, /replaceSemanticValidationBehaviors/);
assert.match(semanticValidationBehaviorInjectionStep.expression, /replaceSemanticValidationBehaviors API not available/);
assert.match(semanticValidationBehaviorInjectionStep.expression, /Semantic provider unavailable\./);
assert.match(semanticValidationBehaviorInjectionStep.expression, /event_date/);

assert.throws(
  () => buildQueuedSemanticValidationBehaviorsStep(),
  /requires behaviors/i,
);

const queuedSemanticValidationBehaviorsStep = buildQueuedSemanticValidationBehaviorsStep({
  behaviors: [
    {
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "country_code"],
        measures: ["available_impressions", "household_uniques"],
      },
      delayMs: 800,
      result: {
        valid: true,
        normalizedSelection: {
          entity: "line_delivery",
          dimensions: ["event_date", "channel", "country_code"],
          measures: ["available_impressions", "household_uniques"],
        },
        diagnostics: [],
      },
    },
    {
      match: {
        modelRef: "model://example/performance/delivery@v1",
        entity: "line_delivery",
        dimensions: ["event_date", "channel", "age_group"],
        measures: ["available_impressions", "household_uniques"],
      },
      delayMs: 800,
      error: "Queued semantic provider unavailable.",
    },
  ],
});
assert.equal(queuedSemanticValidationBehaviorsStep.type, "eval");
assert.match(queuedSemanticValidationBehaviorsStep.expression, /queueSemanticValidationBehavior/);
assert.match(queuedSemanticValidationBehaviorsStep.expression, /clearSemanticValidationBehaviors/);
assert.match(queuedSemanticValidationBehaviorsStep.expression, /Queued semantic provider unavailable\./);
assert.match(queuedSemanticValidationBehaviorsStep.expression, /country_code/);

const appendedQueuedSemanticValidationBehaviorsStep = buildQueuedSemanticValidationBehaviorsStep({
  clearExisting: false,
  behaviors: [{
    match: {
      entity: "line_delivery",
    },
    delayMs: 900,
  }],
});
assert.equal(appendedQueuedSemanticValidationBehaviorsStep.type, "eval");
assert.match(appendedQueuedSemanticValidationBehaviorsStep.expression, /queueSemanticValidationBehavior/);
assert.doesNotMatch(appendedQueuedSemanticValidationBehaviorsStep.expression, /clearSemanticValidationBehaviors/);
assert.match(appendedQueuedSemanticValidationBehaviorsStep.expression, /"delayMs":900/);

assert.throws(
  () => buildPreviewFetchBehaviorReplacementStep(),
  /requires behaviors/i,
);

const previewFetchBehaviorReplacementStep = buildPreviewFetchBehaviorReplacementStep({
  resetCounters: true,
  behaviors: [
    {
      match: {
        type: "chartquery",
      },
      delayMs: 5000,
      error: "Stale chart query failed.",
    },
    {
      match: {
        type: "chartquery",
      },
      result: {
        rows: [
          { eventDate: "2026-05-03", channelV2: "Audio", hhUniqs: 333 },
          { eventDate: "2026-05-04", channelV2: "Social", hhUniqs: 444 },
        ],
        hasMore: false,
      },
    },
  ],
});
assert.equal(previewFetchBehaviorReplacementStep.type, "eval");
assert.match(previewFetchBehaviorReplacementStep.expression, /replaceFetchBehaviors/);
assert.match(previewFetchBehaviorReplacementStep.expression, /preview\.resetCounters\(\)/);
assert.match(previewFetchBehaviorReplacementStep.expression, /Stale chart query failed\./);
assert.match(previewFetchBehaviorReplacementStep.expression, /Audio/);

const previewFetchBehaviorReplacementWithoutResetStep = buildPreviewFetchBehaviorReplacementStep({
  behaviors: [{
    match: {
      type: "chartquery",
    },
    error: "Replacement chart query failed.",
  }],
});
assert.equal(previewFetchBehaviorReplacementWithoutResetStep.type, "eval");
assert.match(previewFetchBehaviorReplacementWithoutResetStep.expression, /replaceFetchBehaviors/);
assert.doesNotMatch(previewFetchBehaviorReplacementWithoutResetStep.expression, /preview\.resetCounters\(\)/);
assert.match(previewFetchBehaviorReplacementWithoutResetStep.expression, /Replacement chart query failed\./);

assert.throws(
  () => buildPreviewLifecycleBehaviorReplacementStep(),
  /requires behaviors/i,
);

const previewLifecycleBehaviorReplacementStep = buildPreviewLifecycleBehaviorReplacementStep({
  behaviors: [{
    match: {
      action: "archive",
      source: "reportBuilder.catalogEntry",
      title: "Capacity Trend Q3 Published Snapshot",
    },
    error: "Preview lifecycle archive failed.",
  }],
});
assert.equal(previewLifecycleBehaviorReplacementStep.type, "eval");
assert.match(previewLifecycleBehaviorReplacementStep.expression, /replaceLifecycleBehaviors/);
assert.match(previewLifecycleBehaviorReplacementStep.expression, /reportBuilder\.catalogEntry/);
assert.match(previewLifecycleBehaviorReplacementStep.expression, /Preview lifecycle archive failed\./);

assert.throws(
  () => buildPreviewPatchBuilderStateStep(),
  /requires patch/i,
);

const previewPatchBuilderStateStep = buildPreviewPatchBuilderStateStep({
  patch: {
    selectedMeasures: ["hhUniqs"],
    primaryMeasure: "hhUniqs",
    selectedDimensions: ["eventDate", "channelV2"],
    viewMode: "chart",
  },
});
assert.equal(previewPatchBuilderStateStep.type, "eval");
assert.match(previewPatchBuilderStateStep.expression, /patchBuilderState/);
assert.match(previewPatchBuilderStateStep.expression, /hhUniqs/);
assert.match(previewPatchBuilderStateStep.expression, /channelV2/);

assert.throws(
  () => buildPreviewPatchBuilderConfigStep(),
  /requires patch/i,
);

const previewPatchBuilderConfigStep = buildPreviewPatchBuilderConfigStep({
  patch: {
    result: {
      chartDataMode: "currentPage",
      chartRowLimit: 1000,
    },
  },
});
assert.equal(previewPatchBuilderConfigStep.type, "eval");
assert.match(previewPatchBuilderConfigStep.expression, /patchBuilderConfig/);
assert.match(previewPatchBuilderConfigStep.expression, /chartDataMode/);
assert.match(previewPatchBuilderConfigStep.expression, /currentPage/);

const clearSemanticValidationBehaviorsStep = buildClearSemanticValidationBehaviorsStep();
assert.equal(clearSemanticValidationBehaviorsStep.type, "eval");
assert.match(clearSemanticValidationBehaviorsStep.expression, /clearSemanticValidationBehaviors/);

const reopenedCompileDiagnosticsWaitSteps = buildReopenedCompileDiagnosticsWaitSteps({
  texts: [
    "Primary Chart is no longer compatible with the current builder selection.",
    "documentBlockChartInvalid",
  ],
});
assert.equal(reopenedCompileDiagnosticsWaitSteps.length, 4);
assert.deepEqual(reopenedCompileDiagnosticsWaitSteps[0], {
  type: "waitForDomContains",
  text: "Reopened compile diagnostics",
  timeoutMs: 60000,
});
assert.deepEqual(reopenedCompileDiagnosticsWaitSteps[1], {
  type: "waitForDomContains",
  text: "Primary Chart is no longer compatible with the current builder selection.",
  timeoutMs: 60000,
});
assert.match(reopenedCompileDiagnosticsWaitSteps[3].expression, /reopenedCompileState\?\.status === "invalid"/);

const discardDraftSteps = buildDiscardDraftAndRequirePreviewOnlyRuntimeSteps({
  runtimePanelSelector: ".forge-report-runtime-chart-panel",
});
assert.equal(discardDraftSteps.length, 4);
assert.deepEqual(discardDraftSteps[0], {
  type: "clickRole",
  role: "button",
  name: "Discard draft",
});
assert.deepEqual(discardDraftSteps[1], {
  type: "waitForDomContains",
  text: "Draft discarded.",
  timeoutMs: 60000,
});
assert.match(discardDraftSteps[2].expression, /Local Draft/);
assert.match(discardDraftSteps[3].expression, /panels\.length >= 1/);
assert.match(discardDraftSteps[3].expression, /forge-report-runtime-chart-panel/);

assert.throws(
  () => buildReopenedHydratedSessionVerificationSteps(),
  /requires reportTitle, reportId, and documentVersion/i,
);

const reopenedSessionSteps = buildReopenedHydratedSessionVerificationSteps({
  reportTitle: "Capacity KPI Blend Q3",
  reportId: "capacityKpiBlendByDateQ3",
  documentVersion: 11,
  includeSummaryNotice: true,
});
assert.equal(reopenedSessionSteps.length, 4);
assert.deepEqual(reopenedSessionSteps[0], {
  type: "clickRole",
  role: "button",
  name: "Reopen in builder",
});
assert.equal(reopenedSessionSteps[1].text, "Reopened ReportDocument Capacity KPI Blend Q3 for editing.");
assert.equal(reopenedSessionSteps[2].text, "Reopened ReportDocument: Capacity KPI Blend Q3");
assert.match(reopenedSessionSteps[3].expression, /getHydratedReportDocumentSession/);
assert.match(reopenedSessionSteps[3].expression, /capacityKpiBlendByDateQ3/);
assert.match(reopenedSessionSteps[3].expression, /documentVersion === 11/);

assert.throws(
  () => buildDrillNavigationProviderRoutePresetSelectionSteps(),
  /requires breakdownField and targetRef/i,
);

const providerPresetSelectionSteps = buildDrillNavigationProviderRoutePresetSelectionSteps({
  breakdownField: "channelV2",
  targetRef: "target://example/performance/channel-detail",
});
assert.equal(providerPresetSelectionSteps.length, 3);
assert.match(providerPresetSelectionSteps[0].expression, /Breakdown field select not found/);
assert.match(providerPresetSelectionSteps[0].expression, /channelV2/);
assert.match(providerPresetSelectionSteps[1].expression, /routePreset\.options/);
assert.match(providerPresetSelectionSteps[1].expression, /target:\/\/example\/performance\/channel-detail/);
assert.match(providerPresetSelectionSteps[2].expression, /Route preset select not found/);
assert.match(providerPresetSelectionSteps[2].expression, /target:\/\/example\/performance\/channel-detail/);

const reopenedExportSteps = buildReopenedExportInspectionSteps({
  reopenedNoticeText: "Reopened ReportDocument: Capacity Trend Q3",
  expectedFilename: "Capacity Trend Q3-savedPayload-pdf-export-request.json",
  exportTitle: "Capacity Trend Q3",
  bookmarkId: "bookmark.primaryChart",
  extraPayloadText: "Channel Trend",
});

assert.equal(reopenedExportSteps.length, 6);
assert.equal(reopenedExportSteps[0].type, "waitForEval");
assert.match(reopenedExportSteps[0].expression, /Review export/);
assert.match(reopenedExportSteps[1].expression, /Inspect export button not found/);
assert.equal(reopenedExportSteps[4].type, "waitForEval");
assert.match(reopenedExportSteps[4].expression, /payloadReady === true/);
assert.match(reopenedExportSteps[4].expression, /Capacity Trend Q3-savedPayload-pdf-export-request\.json/);
assert.equal(reopenedExportSteps[5].type, "waitForEval");
assert.match(reopenedExportSteps[5].expression, /payloadReady/);
assert.match(reopenedExportSteps[5].expression, /bookmark\.primaryChart/);
assert.match(reopenedExportSteps[5].expression, /Channel Trend/);

assert.throws(
  () => buildImportedListEntryFixturePreparationSteps(),
  /requires fixtureModulePath and fixtureBuilderName/i,
);

const importedListEntrySteps = buildImportedListEntryFixturePreparationSteps({
  fixtureModulePath: "/src/reporting/fixtures/capacityAudienceLandscapeFixtureState.js",
  fixtureBuilderName: "buildCapacityAudienceLandscapeFixtureState",
  savedRecordFilename: "capacity-audience.saved-report-record.execution.json",
  listResponseFilename: "capacity-audience.list-response.execution.json",
  captureDownloads: true,
});

assert.equal(importedListEntrySteps.length, 12);
assert.equal(importedListEntrySteps[0].type, "goto");
assert.match(importedListEntrySteps[5].expression, /__artifactDownloadCapture/);
assert.match(importedListEntrySteps[6].expression, /buildCapacityAudienceLandscapeFixtureState/);
assert.match(importedListEntrySteps[6].expression, /capacity-audience\.saved-report-record\.execution\.json/);
assert.match(importedListEntrySteps[8].expression, /buildCapacityAudienceLandscapeFixtureState/);
assert.match(importedListEntrySteps[8].expression, /capacity-audience\.list-response\.execution\.json/);
assert.equal(importedListEntrySteps[11].text, "Selected entry: Capacity Audience Segment Index Q3");

const submitExportButtonStep = buildSelectedListEntryExportButtonStep();
assert.equal(submitExportButtonStep.type, "eval");
assert.match(submitExportButtonStep.expression, /Selected list entry export submit button not found/);
assert.match(submitExportButtonStep.expression, /List ReportDocuments response:/);

const inspectExportButtonStep = buildSelectedListEntryExportButtonStep({ mode: "inspect" });
assert.equal(inspectExportButtonStep.type, "eval");
assert.match(inspectExportButtonStep.expression, /Selected list entry export button not found/);
assert.match(inspectExportButtonStep.expression, /Inspect export/);

assert.throws(
  () => buildTitledCardButtonClickStep(),
  /requires title/i,
);

assert.throws(
  () => buildTitledCardButtonClickStep({
    title: "Imported Detail Target Modal Demo",
  }),
  /requires buttonTexts or buttonTextPattern/i,
);

const titledCardButtonStep = buildTitledCardButtonClickStep({
  title: "Imported Detail Target Modal Demo",
  buttonTexts: ["Use"],
  missingButtonMessage: "Imported Detail Target Modal Demo Use button not found.",
});
assert.equal(titledCardButtonStep.type, "eval");
assert.match(titledCardButtonStep.expression, /text === "Use"/);
assert.match(titledCardButtonStep.expression, /title === "Imported Detail Target Modal Demo"/);
assert.match(titledCardButtonStep.expression, /firstElementChild/);
assert.match(titledCardButtonStep.expression, /Imported Detail Target Modal Demo Use button not found\./);

const patternedTitledCardButtonStep = buildTitledCardButtonClickStep({
  title: "Imported Detail Target Modal Demo",
  buttonTextPattern: "^Review .* export$",
});
assert.equal(patternedTitledCardButtonStep.type, "eval");
assert.match(patternedTitledCardButtonStep.expression, /\^Review \.\* export\$/);

assert.throws(
  () => buildTemporaryDetailTargetMutationSteps(),
  /requires temporaryTargetRef, authoredTargetRef, and fieldRef/i,
);

const temporaryDetailTargetMutationSteps = buildTemporaryDetailTargetMutationSteps({
  temporaryTargetRef: "target://example/performance/channel-detail",
  authoredTargetRef: "target://example/performance/channel-detail-modal",
  fieldRef: "channelV2",
});
assert.equal(temporaryDetailTargetMutationSteps.length, 2);
assert.match(temporaryDetailTargetMutationSteps[0].expression, /patchBuilderState API not available for mutation/);
assert.match(temporaryDetailTargetMutationSteps[0].expression, /target:\/\/example\/performance\/channel-detail/);
assert.match(temporaryDetailTargetMutationSteps[0].expression, /detail_channelV2_target_example_performance_channel_detail/);
assert.match(temporaryDetailTargetMutationSteps[1].expression, /target\.navigationMode === "hostRoute"/);
assert.match(temporaryDetailTargetMutationSteps[1].expression, /target:\/\/example\/performance\/channel-detail-modal/);

assert.throws(
  () => buildAuthoredDetailTargetRestorationWaitStep(),
  /requires targetRef/i,
);

assert.throws(
  () => buildAuthoredDetailTargetRestorationWaitStep({
    targetRef: "target://example/performance/channel-detail-modal",
    requireFieldAction: true,
  }),
  /requires fieldRef when field-action validation is enabled/i,
);

const authoredDetailTargetRestorationWaitStep = buildAuthoredDetailTargetRestorationWaitStep({
  targetRef: "target://example/performance/channel-detail-modal",
  fieldRef: "channelV2",
  parameters: {
    channel: "$value",
    eventDate: "$row.eventDate",
    source: "archived",
  },
  requireFieldAction: true,
});
assert.equal(authoredDetailTargetRestorationWaitStep.type, "waitForEval");
assert.match(authoredDetailTargetRestorationWaitStep.expression, /target\.navigationMode !== "modal"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /target\.parameters\?\.channel === "\$value"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /target\.parameters\?\.eventDate === "\$row\.eventDate"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /target\.parameters\?\.source === "archived"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /entry\.fieldRef === "channelV2"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /entry\.targetRef === "target:\/\/example\/performance\/channel-detail-modal"/);
assert.match(authoredDetailTargetRestorationWaitStep.expression, /const detailTargets = Array\.isArray/);

const authoredDetailTargetRestorationWithAbsenceWaitStep = buildAuthoredDetailTargetRestorationWaitStep({
  targetRef: "target://example/performance/channel-detail-modal",
  fieldRef: "channelV2",
  parameters: {
    source: "archived",
  },
  requireFieldAction: true,
  absentDetailTargetRefs: ["target://example/performance/channel-detail"],
  absentFieldActionTargetRefs: ["target://example/performance/channel-detail"],
});
assert.match(authoredDetailTargetRestorationWithAbsenceWaitStep.expression, /detailTargets\.some\(\(detailTarget\) => detailTarget\.targetRef === "target:\/\/example\/performance\/channel-detail"\)/);
assert.match(authoredDetailTargetRestorationWithAbsenceWaitStep.expression, /fieldAction\.actions\.some\(\(action\) => action\.targetRef === "target:\/\/example\/performance\/channel-detail"\)/);

assert.throws(
  () => buildRuntimeDetailTargetResolutionSteps(),
  /requires actionText/i,
);

assert.throws(
  () => buildRuntimeDetailTargetResolutionSteps({
    actionText: "Show Channel details",
  }),
  /requires expectedTexts/i,
);

const runtimeDetailTargetResolutionSteps = buildRuntimeDetailTargetResolutionSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  actionText: "Show Channel details",
  expectedTexts: [
    "target://example/performance/channel-detail-modal",
    "archived",
  ],
  forbiddenTexts: [
    "Failed to resolve detail target",
  ],
});
assert.equal(runtimeDetailTargetResolutionSteps.length, 4);
assert.deepEqual(runtimeDetailTargetResolutionSteps[0], {
  type: "waitForEval",
  expression: "document.querySelectorAll(\".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action\").length >= 1",
  timeoutMs: 60000,
});
assert.deepEqual(runtimeDetailTargetResolutionSteps[1], {
  type: "clickSelectorContains",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
  text: "Show Channel details",
  index: 0,
});
assert.deepEqual(runtimeDetailTargetResolutionSteps[2], {
  type: "waitForDomContains",
  text: "Resolved detail target",
  timeoutMs: 60000,
});
assert.match(runtimeDetailTargetResolutionSteps[3].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-host-intent/);
assert.match(runtimeDetailTargetResolutionSteps[3].expression, /text\.includes\("target:\/\/example\/performance\/channel-detail-modal"\)/);
assert.match(runtimeDetailTargetResolutionSteps[3].expression, /text\.includes\("archived"\)/);
assert.match(runtimeDetailTargetResolutionSteps[3].expression, /!runtimeText\.includes\("Failed to resolve detail target"\)/);

assert.throws(
  () => buildRuntimeChartDetailTargetResolutionSteps(),
  /requires actionText/i,
);

assert.throws(
  () => buildRuntimeChartDetailTargetResolutionSteps({
    actionText: "Show date details",
  }),
  /requires selectedValueTexts/i,
);

const runtimeChartDetailTargetResolutionSteps = buildRuntimeChartDetailTargetResolutionSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  actionText: "Show date details",
  selectedValueTexts: ["Selected value:", "2026-05-01"],
  expectedTexts: ["target://example/performance/date-detail", "US"],
  forbiddenTexts: ["Failed to resolve detail target"],
});
assert.equal(runtimeChartDetailTargetResolutionSteps.length, 6);
assert.match(runtimeChartDetailTargetResolutionSteps[0].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-chart-panel/);
assert.deepEqual(runtimeChartDetailTargetResolutionSteps[1], {
  type: "clickSelector",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle",
  index: 0,
});
assert.match(runtimeChartDetailTargetResolutionSteps[2].expression, /Selected value:/);
assert.deepEqual(runtimeChartDetailTargetResolutionSteps[3], {
  type: "clickSelectorContains",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action",
  text: "Show date details",
  index: 0,
});
assert.match(runtimeChartDetailTargetResolutionSteps[5].expression, /target:\/\/example\/performance\/date-detail/);
assert.match(runtimeChartDetailTargetResolutionSteps[5].expression, /!runtimeText\.includes\("Failed to resolve detail target"\)/);

const runtimeHostIntentDismissSteps = buildRuntimeHostIntentDismissSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  missingButtonMessage: "Preview dismiss intent button not found.",
});
assert.equal(runtimeHostIntentDismissSteps.length, 2);
assert.match(runtimeHostIntentDismissSteps[0].expression, /Preview dismiss intent button not found\./);
assert.match(runtimeHostIntentDismissSteps[1].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-host-intent/);
assert.match(runtimeHostIntentDismissSteps[1].expression, /== null/);

assert.throws(
  () => buildStandaloneRuntimeChartDetailTargetResolutionSteps(),
  /requires actionText/i,
);

const standaloneRuntimeChartDetailTargetResolutionSteps = buildStandaloneRuntimeChartDetailTargetResolutionSteps({
  actionText: "Show date details",
  selectedValueTexts: ["Selected value:", "2026-05-01"],
  expectedTexts: ["target://example/performance/date-detail", "US"],
  forbiddenTexts: ["Failed to resolve detail target"],
  missingMarkMessage: "Reopened standalone runtime chart mark not found.",
  missingActionMessage: "Reopened standalone runtime Show date details action not found.",
});
assert.equal(standaloneRuntimeChartDetailTargetResolutionSteps.length, 5);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[0].expression, /!entry\.closest\("\.forge-report-builder__runtime-preview"\)/);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[1].expression, /Reopened standalone runtime chart mark not found\./);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[2].expression, /Selected value:/);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[3].expression, /Reopened standalone runtime Show date details action not found\./);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[4].expression, /document\.querySelectorAll\("\.forge-report-runtime-host-intent"\)/);
assert.match(standaloneRuntimeChartDetailTargetResolutionSteps[4].expression, /!text\.includes\("Failed to resolve detail target"\)/);

assert.throws(
  () => buildDetailTargetBehaviorInjectionSteps(),
  /requires targetRef/i,
);

const detailTargetBehaviorInjectionSteps = buildDetailTargetBehaviorInjectionSteps({
  targetRef: "target://example/performance/channel-detail",
});
assert.equal(detailTargetBehaviorInjectionSteps.length, 2);
assert.match(detailTargetBehaviorInjectionSteps[0].expression, /replaceDetailTargetBehaviors API not available/);
assert.match(detailTargetBehaviorInjectionSteps[0].expression, /target:\/\/example\/performance\/channel-detail/);
assert.match(detailTargetBehaviorInjectionSteps[1].expression, /detailTargetBehaviors\.length === 1/);

assert.throws(
  () => buildDetailTargetBehaviorNullResultSteps(),
  /requires targetRef/i,
);

const detailTargetBehaviorNullResultSteps = buildDetailTargetBehaviorNullResultSteps({
  targetRef: "target://example/performance/channel-detail",
});
assert.equal(detailTargetBehaviorNullResultSteps.length, 2);
assert.match(detailTargetBehaviorNullResultSteps[0].expression, /replaceDetailTargetBehaviors API not available/);
assert.match(detailTargetBehaviorNullResultSteps[0].expression, /detailTarget: null/);
assert.match(detailTargetBehaviorNullResultSteps[1].expression, /detailTargetBehaviors\.length === 1/);

const clearDetailTargetBehaviorsSteps = buildClearDetailTargetBehaviorsSteps({
  missingApiMessage: "clearDetailTargetBehaviors API not available.",
});
assert.equal(clearDetailTargetBehaviorsSteps.length, 2);
assert.match(clearDetailTargetBehaviorsSteps[0].expression, /clearDetailTargetBehaviors API not available\./);
assert.match(clearDetailTargetBehaviorsSteps[1].expression, /detailTargetBehaviors\.length === 0/);

assert.throws(
  () => buildChartQueryBaselineResetSteps(),
  /requires baselineKey/i,
);

const chartQueryBaselineResetSteps = buildChartQueryBaselineResetSteps({
  baselineKey: "__chartBaseline",
});
assert.equal(chartQueryBaselineResetSteps.length, 2);
assert.match(chartQueryBaselineResetSteps[0].expression, /resetCounters API not available/);
assert.match(chartQueryBaselineResetSteps[0].expression, /__chartBaseline/);
assert.match(chartQueryBaselineResetSteps[0].expression, /entry\.type === "chartQuery"/);
assert.match(chartQueryBaselineResetSteps[1].expression, /baseline\.requestCount === 0/);

assert.throws(
  () => buildChartQueryBaselineStableWaitStep(),
  /requires baselineKey/i,
);

const chartQueryBaselineStableWaitStep = buildChartQueryBaselineStableWaitStep({
  baselineKey: "__chartBaseline",
});
assert.equal(chartQueryBaselineStableWaitStep.type, "waitForEval");
assert.match(chartQueryBaselineStableWaitStep.expression, /preview\?\.\["__chartBaseline"\]/);
assert.match(chartQueryBaselineStableWaitStep.expression, /requestCount === baseline\.requestCount/);

assert.throws(
  () => buildRuntimeDetailTargetFailureSteps(),
  /requires actionText and failureTargetRef/i,
);

const runtimeDetailTargetFailureSteps = buildRuntimeDetailTargetFailureSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  actionText: "Show channel details",
  failureTargetRef: "target://example/performance/channel-detail",
});
assert.equal(runtimeDetailTargetFailureSteps.length, 5);
assert.deepEqual(runtimeDetailTargetFailureSteps[0], {
  type: "waitForEval",
  expression: "document.querySelectorAll(\".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action\").length >= 1",
  timeoutMs: 60000,
});
assert.deepEqual(runtimeDetailTargetFailureSteps[1], {
  type: "clickSelectorContains",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action",
  text: "Show channel details",
  index: 0,
});
assert.deepEqual(runtimeDetailTargetFailureSteps[2], {
  type: "waitForDomContains",
  text: "Runtime Diagnostics",
  timeoutMs: 60000,
});
assert.match(runtimeDetailTargetFailureSteps[3].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-host-intent/);
assert.match(runtimeDetailTargetFailureSteps[4].expression, /Failed to resolve detail target target:\/\/example\/performance\/channel-detail\. Detail target resolution failed\./);
assert.match(runtimeDetailTargetFailureSteps[4].expression, /!text\.includes\("Resolved detail target"\)/);

assert.throws(
  () => buildRuntimeChartDetailTargetFailureSteps(),
  /requires actionText and failureTargetRef/i,
);

assert.throws(
  () => buildRuntimeChartDetailTargetFailureSteps({
    actionText: "Show channel details",
    failureTargetRef: "target://example/performance/channel-detail",
  }),
  /requires selectedValueTexts/i,
);

const runtimeChartDetailTargetFailureSteps = buildRuntimeChartDetailTargetFailureSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  actionText: "Show channel details",
  selectedValueTexts: ["Selected value:", "Display"],
  failureTargetRef: "target://example/performance/channel-detail",
});
assert.equal(runtimeChartDetailTargetFailureSteps.length, 5);
assert.match(runtimeChartDetailTargetFailureSteps[0].expression, /Selected value:/);
assert.match(runtimeChartDetailTargetFailureSteps[0].expression, /Display/);
assert.deepEqual(runtimeChartDetailTargetFailureSteps[1], {
  type: "clickSelectorContains",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action",
  text: "Show channel details",
  index: 0,
});
assert.deepEqual(runtimeChartDetailTargetFailureSteps[2], {
  type: "waitForDomContains",
  text: "Runtime Diagnostics",
  timeoutMs: 60000,
});
assert.match(runtimeChartDetailTargetFailureSteps[3].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-host-intent/);
assert.match(runtimeChartDetailTargetFailureSteps[4].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-chart-panel/);
assert.match(runtimeChartDetailTargetFailureSteps[4].expression, /Failed to resolve detail target target:\/\/example\/performance\/channel-detail\. Detail target resolution failed\./);

assert.throws(
  () => buildRuntimeChartActionSelectionSteps(),
  /requires actionText/i,
);

assert.throws(
  () => buildRuntimeChartActionSelectionSteps({
    actionText: "Show channel details",
  }),
  /requires selectedValueTexts/i,
);

const runtimeChartActionSelectionSteps = buildRuntimeChartActionSelectionSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  actionText: "Show channel details",
  selectedValueTexts: ["Selected value:", "Display"],
  clickMarkIndex: 1,
});
assert.equal(runtimeChartActionSelectionSteps.length, 4);
assert.deepEqual(runtimeChartActionSelectionSteps[0], {
  type: "waitForEval",
  expression: "document.querySelectorAll(\".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle\").length >= 2",
  timeoutMs: 60000,
});
assert.deepEqual(runtimeChartActionSelectionSteps[1], {
  type: "clickSelector",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle",
  index: 1,
});
assert.match(runtimeChartActionSelectionSteps[2].expression, /Selected value:/);
assert.match(runtimeChartActionSelectionSteps[2].expression, /Display/);
assert.deepEqual(runtimeChartActionSelectionSteps[3], {
  type: "clickSelectorContains",
  selector: ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action",
  text: "Show channel details",
  index: 0,
});

assert.throws(
  () => buildRuntimeResolvedDetailTargetWaitSteps(),
  /requires expectedTexts/i,
);

const runtimeResolvedDetailTargetWaitSteps = buildRuntimeResolvedDetailTargetWaitSteps({
  runtimeScopeSelector: ".forge-report-builder__runtime-preview",
  expectedTexts: ["target://example/performance/channel-detail", "CTV"],
  forbiddenTexts: ["Detail target resolution failed."],
  requireHostIntent: true,
});
assert.equal(runtimeResolvedDetailTargetWaitSteps.length, 2);
assert.match(runtimeResolvedDetailTargetWaitSteps[0].expression, /text\.includes\("Resolved detail target"\)/);
assert.match(runtimeResolvedDetailTargetWaitSteps[0].expression, /text\.includes\("target:\/\/example\/performance\/channel-detail"\)/);
assert.match(runtimeResolvedDetailTargetWaitSteps[0].expression, /!text\.includes\("Detail target resolution failed\."\)/);
assert.match(runtimeResolvedDetailTargetWaitSteps[1].expression, /\.forge-report-builder__runtime-preview \.forge-report-runtime-host-intent/);
assert.match(runtimeResolvedDetailTargetWaitSteps[1].expression, /!= null/);

assert.throws(
  () => buildSectionButtonClickStep(),
  /requires sectionIncludes/i,
);

assert.throws(
  () => buildSectionButtonClickStep({
    sectionIncludes: "Imported export request:",
  }),
  /requires buttonTexts or buttonTextPattern/i,
);

const scopedInspectStep = buildSectionButtonClickStep({
  sectionIncludes: "Imported export request:",
  buttonTexts: ["Inspect export", "Hide export"],
  missingSectionMessage: "imported export request notice not found",
  missingButtonMessage: "inspect export button not found",
});
assert.equal(scopedInspectStep.type, "eval");
assert.match(scopedInspectStep.expression, /Imported export request:/);
assert.match(scopedInspectStep.expression, /Inspect export/);
assert.match(scopedInspectStep.expression, /Hide export/);
assert.match(scopedInspectStep.expression, /imported export request notice not found/);
assert.match(scopedInspectStep.expression, /inspect export button not found/);

const patternScopedStep = buildSectionButtonClickStep({
  sectionIncludes: "List ReportDocuments response:",
  sectionSelector: ".forge-report-builder__chart-inline-notice",
  buttonTextPattern: "^Review .* export$",
});
assert.equal(patternScopedStep.type, "eval");
assert.match(patternScopedStep.expression, /forge-report-builder__chart-inline-notice/);
assert.match(patternScopedStep.expression, /\^Review \.\* export\$/);

assert.throws(
  () => buildAriaSectionButtonClickStep(),
  /requires ariaLabel/i,
);

const importedRuntimeSectionStep = buildAriaSectionButtonClickStep({
  ariaLabel: "Imported runtime preview",
  buttonTexts: ["Inspect export", "Hide export"],
  missingSectionMessage: "imported runtime section not found",
  missingButtonMessage: "inspect export button not found",
});
assert.equal(importedRuntimeSectionStep.type, "eval");
assert.match(importedRuntimeSectionStep.expression, /Imported runtime preview/);
assert.match(importedRuntimeSectionStep.expression, /Inspect export/);
assert.match(importedRuntimeSectionStep.expression, /imported runtime section not found/);

const seededImportSteps = buildSeededSavedPayloadArtifactImportSteps({
  reportId: "capacityTrendQ3",
  artifactExpression: "record?.exportRequest?.reportFill",
  filename: "capacity-trend.report-fill.json",
  missingArtifactMessage: "seeded report fill not found",
  importedNoticeText: "Imported ReportFill capacity-trend.report-fill. Inspect or download is ready.",
});
assert.equal(seededImportSteps.length, 8);
assert.match(seededImportSteps[6].expression, /getSeededSavedReportPayloads/);
assert.match(seededImportSteps[6].expression, /record\?\.exportRequest\?\.reportFill/);
assert.match(seededImportSteps[6].expression, /capacity-trend\.report-fill\.json/);
assert.match(seededImportSteps[6].expression, /seeded saved report payload 'capacityTrendQ3' not found/);
assert.equal(seededImportSteps[7].text, "Imported ReportFill capacity-trend.report-fill. Inspect or download is ready.");

const defaultSeededImportSteps = buildSeededSavedPayloadArtifactImportSteps({
  reportId: "capacityTrendQ3",
  filename: "capacity-trend.saved-payload.json",
  missingArtifactMessage: "seeded payload not found",
});
assert.equal(defaultSeededImportSteps.length, 7);
assert.match(defaultSeededImportSteps[6].expression, /const artifact = payload;/);
assert.doesNotMatch(defaultSeededImportSteps[6].expression, /payloads\[0\]/);

const missingSeededImportWindow = {
  __REPORT_BUILDER_PREVIEW__: {
    getSeededSavedReportPayloads() {
      return [
        {
          savedReportPayload: {
            reportDocument: {
              id: "capacityOtherQ3",
            },
          },
        },
      ];
    },
  },
};
const missingSeededImportInput = {
  files: null,
  dispatchEvent() {},
};
const missingSeededImportDocument = {
  querySelector(selector = "") {
    return selector === 'input[aria-label="Import report file"]'
      ? missingSeededImportInput
      : null;
  },
};
const executeSeededImportExpression = new Function(
  "window",
  "document",
  "File",
  "DataTransfer",
  "Event",
  `return ${seededImportSteps[6].expression};`,
);
assert.throws(
  () => executeSeededImportExpression(
    missingSeededImportWindow,
    missingSeededImportDocument,
    function MockFile() {},
    function MockDataTransfer() {
      this.items = { add() {} };
      this.files = [];
    },
    function MockEvent() {},
  ),
  /seeded saved report payload 'capacityTrendQ3' not found/i,
);

assert.throws(
  () => buildInlineArtifactImportSteps(),
  /requires artifactExpression/i,
);

const inlineImportSteps = buildInlineArtifactImportSteps({
  artifactExpression: "{ kind: 'createReportDocumentPayload', title: 'Capacity Trend Q3' }",
  filename: "capacity-trend.create-report-document.json",
  importedNoticeText: "Imported createReportDocument payload Capacity Trend Q3.",
});
assert.equal(inlineImportSteps.length, 8);
assert.match(inlineImportSteps[6].expression, /createReportDocumentPayload/);
assert.match(inlineImportSteps[6].expression, /capacity-trend\.create-report-document\.json/);
assert.equal(inlineImportSteps[7].text, "Imported createReportDocument payload Capacity Trend Q3.");

assert.throws(
  () => buildImportedFixtureArtifactSteps(),
  /requires fixtureModulePath, fixtureBuilderName, and fixtureValueExpression/i,
);

const importedFixtureSteps = buildImportedFixtureArtifactSteps({
  fixtureModulePath: "/src/reporting/fixtures/capacityAudienceArtifactFixtureState.js",
  fixtureBuilderName: "buildCapacityAudienceArtifactFixtureState",
  fixtureValueExpression: "fixture.savedReportRecord",
  filename: "capacity-audience.saved-report-record.json",
  importedNoticeText: "Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.",
});

assert.equal(importedFixtureSteps.length, 8);
assert.match(importedFixtureSteps[6].expression, /buildCapacityAudienceArtifactFixtureState/);
assert.match(importedFixtureSteps[6].expression, /fixture\.savedReportRecord/);
assert.match(importedFixtureSteps[6].expression, /capacity-audience\.saved-report-record\.json/);
assert.equal(importedFixtureSteps[7].text, "Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.");

const audienceSemanticWaitStep = buildAudienceSemanticBindingWaitStep({
  extraText: "export-ready",
});
assert.equal(audienceSemanticWaitStep.type, "waitForEval");
assert.match(audienceSemanticWaitStep.expression, /Semantic Binding/);
assert.match(audienceSemanticWaitStep.expression, /Model Ad Delivery/);
assert.match(audienceSemanticWaitStep.expression, /Entity Line Delivery/);
assert.match(audienceSemanticWaitStep.expression, /Measures Audience Index/);
assert.match(audienceSemanticWaitStep.expression, /export-ready/);

const definitionRefWaitSteps = buildAudienceDefinitionRefWaitSteps({
  extraTexts: ['"kind": "getReportDocumentResponse"'],
});
assert.equal(definitionRefWaitSteps.length, 3);
assert.equal(definitionRefWaitSteps[0].text, '"kind": "getReportDocumentResponse"');
assert.equal(definitionRefWaitSteps[1].text, '"definitionRef": "harmonizer://feature/user.segment.index"');
assert.equal(definitionRefWaitSteps[2].text, '"definitionRef": "harmonizer://feature/user.segment"');

const audienceReopenSteps = buildAudienceReopenVerificationSteps();
assert.equal(audienceReopenSteps.length, 5);
assert.equal(audienceReopenSteps[0].name, "Reopen in builder");
assert.equal(audienceReopenSteps[1].text, "Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.");
assert.equal(audienceReopenSteps[2].text, "Reopened ReportDocument: Capacity Audience Segment Index Q3");
assert.match(audienceReopenSteps[4].expression, /audienceIndex/);
assert.match(audienceReopenSteps[4].expression, /Young Adults/);

const audienceArtifactInspectionSteps = buildAudienceArtifactInspectionSteps({
  summaryTexts: ["Imported export request:"],
  semanticExtraText: "ReportPrint",
  inspectActionStep: {
    type: "clickRole",
    role: "button",
    name: "Inspect export",
  },
  inspectResultTexts: ['"kind": "reportExportRequest"', '"kind": "reportPrint"'],
});
assert.equal(audienceArtifactInspectionSteps.length, 7);
assert.equal(audienceArtifactInspectionSteps[0].text, "Imported export request:");
assert.match(audienceArtifactInspectionSteps[1].expression, /ReportPrint/);
assert.equal(audienceArtifactInspectionSteps[2].name, "Inspect export");
assert.equal(audienceArtifactInspectionSteps[3].text, '"kind": "reportExportRequest"');
assert.equal(audienceArtifactInspectionSteps[4].text, '"kind": "reportPrint"');
assert.equal(audienceArtifactInspectionSteps[5].text, '"definitionRef": "harmonizer://feature/user.segment.index"');
assert.equal(audienceArtifactInspectionSteps[6].text, '"definitionRef": "harmonizer://feature/user.segment"');

const audienceReportPrintInspectionSteps = buildAudienceArtifactInspectionSteps({
  summaryTexts: ["Imported ReportPrint:"],
  inspectActionStep: {
    type: "clickRole",
    role: "button",
    name: "Inspect ReportPrint",
  },
  inspectResultTexts: ['"kind": "reportPrint"', '"title": "Capacity Audience Segment Index Q3"'],
  includeDefinitionRefs: false,
});
assert.equal(audienceReportPrintInspectionSteps.length, 5);
assert.equal(audienceReportPrintInspectionSteps[0].text, "Imported ReportPrint:");
assert.equal(audienceReportPrintInspectionSteps[2].name, "Inspect ReportPrint");
assert.equal(audienceReportPrintInspectionSteps[3].text, '"kind": "reportPrint"');
assert.equal(audienceReportPrintInspectionSteps[4].text, '"title": "Capacity Audience Segment Index Q3"');

console.log("report-builder-preview-scenario-builders ✓ emits the implicit-draft saved-payload flow and payloadReady reopen export checks");
