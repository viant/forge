import assert from "node:assert/strict";

import {
  applyReportRuntimeInteractionDrillTransition,
  clearReportRuntimeInteractionDetailState,
} from "../../components/dashboard/reportRuntimeInteractionStateModel.js";
import {
  attachPreviewRuntimeSurfaceApi,
  detachPreviewRuntimeSurfaceApi,
} from "./previewRuntimeSurfaceApi.js";

const baseRuntimeInteraction = {
  refinements: [
    {
      id: "keep:country:primaryChart",
      op: "keep",
      field: "country",
      values: ["US"],
      sourceBlockId: "primaryChart",
      label: "Keep only = US",
    },
  ],
  drillTransitions: [
    {
      refinementId: "keep:country:primaryChart",
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "primaryChart",
    },
  ],
  hostIntent: {
    intentKind: "detailTarget",
    targetRef: "target://steward/performance/market-detail",
    navigationMode: "hostRoute",
    parameters: {
      country: "US",
    },
  },
  detailDiagnostic: {
    code: "detailTargetPartial",
    severity: "warning",
    message: "Detail target resolved with omitted parameters: campaign.",
  },
};

const marketEfficiencyRuntimeInteraction = {
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
    {
      id: "keep:channelV2:reachRateTable",
      op: "keep",
      field: "channelV2",
      values: ["Display"],
      sourceBlockId: "reachRateTable",
      label: "Keep Channel = Display",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:country:reachRateTrend",
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "reachRateTrend",
    },
  ],
  hostIntent: null,
  detailDiagnostic: null,
};

const restoredBuilderState = {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: {
    reportId: "forecastingLocationsTopMarketsQ3",
    title: "Forecasting Locations Top Markets Q3",
    documentVersion: 8,
    templateId: "forecast_location_brief",
    templateLabel: "Forecast Location Brief",
    source: {
      kind: "dashboard.reportBuilder",
      containerId: "demoReportBuilder",
      stateKey: "demoReportBuilder",
      dataSourceRef: "demoReportSource",
    },
    reopenedConfig: {
      result: {
        defaultMode: "chart",
      },
    },
    reopenedSemanticSummary: {
      kind: "semantic",
      modelRef: "model://steward/performance/ad_delivery@v1",
      modelLabel: "Ad Delivery",
      entity: "line_delivery",
      entityLabel: "Line Delivery",
      selectedDimensions: [],
      selectedMeasures: [],
    },
    reopenedSemanticFingerprint: "{\"fingerprint\":true}",
    runtimePreviewInteraction: baseRuntimeInteraction,
    liveSnapshot: {
      config: {
        result: {
          defaultMode: "table",
        },
      },
      state: {
        selectedDimensions: ["country"],
        viewMode: "chart",
      },
    },
  },
};

let currentWindowFormState = {
  demoReportBuilder: restoredBuilderState,
  sibling: {
    untouched: true,
  },
};
let currentBuilderConfig = {
  result: {
    defaultMode: "table",
    pagination: true,
  },
  measures: [
    { id: "avails", label: "Avails" },
  ],
};
let currentCollectionRows = [{ country: "US", avails: 153100 }];
let currentCollectionInfo = { hasMore: false };
let currentControl = { loading: false, error: null };
let currentSavedReportPayloads = [
  {
    savedReportPayload: {
      reportDocument: {
        id: "forecastingLocationQ3",
        title: "Forecasting Location Q3",
      },
      compileState: {
        status: "clean",
        diagnostics: [
          {
            code: "semanticGovernance",
            severity: "warning",
            message: "Market • Deprecated",
          },
        ],
      },
    },
  },
];
let lastPersistedBuilderState = null;
let appliedRefinement = null;
let clearInteractionCount = 0;
let clearDetailCount = 0;
let undoInteractionCount = 0;
let redoInteractionCount = 0;
let standaloneUndoSnapshot = baseRuntimeInteraction;
let standaloneRedoSnapshot = baseRuntimeInteraction;
let standaloneCanUndo = false;
let standaloneCanRedo = false;
const metrics = {};

attachPreviewRuntimeSurfaceApi(metrics, {
  getBuilderConfig() {
    return currentBuilderConfig;
  },
  setBuilderConfig(nextBuilderConfig) {
    currentBuilderConfig = nextBuilderConfig;
  },
  getWindowFormState() {
    return currentWindowFormState;
  },
  setWindowFormState(nextWindowFormState) {
    currentWindowFormState = nextWindowFormState;
  },
  getCollectionRows() {
    return currentCollectionRows;
  },
  setCollectionRows(nextRows) {
    currentCollectionRows = nextRows;
  },
  setCollectionInfo(nextInfo) {
    currentCollectionInfo = nextInfo;
  },
  setControl(nextControl) {
    currentControl = nextControl;
  },
  getSavedReportPayloads() {
    return currentSavedReportPayloads;
  },
  setSavedReportPayloads(nextPayloads) {
    currentSavedReportPayloads = nextPayloads;
  },
  buildSavedReportPayloadRecord(seed = {}) {
    return {
      savedReportPayload: {
        reportDocument: {
          id: seed.reportId || "forecastingAppended",
          title: seed.title || "Forecasting Appended",
        },
      },
      documentVersion: Number(seed.documentVersion || 0) || 0,
    };
  },
  runtimeSurface: {
    get canUndoInteraction() {
      return standaloneCanUndo;
    },
    get canRedoInteraction() {
      return standaloneCanRedo;
    },
    applyRefinement(refinement) {
      appliedRefinement = refinement;
    },
    clearInteractionState() {
      clearInteractionCount += 1;
    },
    clearDetailState() {
      clearDetailCount += 1;
    },
    undoInteractionState() {
      undoInteractionCount += 1;
      standaloneCanUndo = false;
      standaloneCanRedo = true;
      return standaloneUndoSnapshot;
    },
    redoInteractionState() {
      redoInteractionCount += 1;
      standaloneCanUndo = true;
      standaloneCanRedo = false;
      return standaloneRedoSnapshot;
    },
  },
  runtimeInteractionSnapshot: baseRuntimeInteraction,
  stateKey: "demoReportBuilder",
  persistBuilderState(nextBuilderState) {
    lastPersistedBuilderState = nextBuilderState;
  },
});

assert.deepEqual(metrics.getBuilderState(), restoredBuilderState);
assert.deepEqual(metrics.getBuilderConfig(), currentBuilderConfig);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: false,
  canRedo: false,
});

assert.deepEqual(
  metrics.patchBuilderConfig({
    dynamicFilterGroups: [
      {
        id: "scopeRules",
        label: "Scope Rules",
      },
    ],
    pinnedDynamicGroupIds: ["scopeRules"],
  }),
  {
    ...currentBuilderConfig,
    dynamicFilterGroups: [
      {
        id: "scopeRules",
        label: "Scope Rules",
      },
    ],
    pinnedDynamicGroupIds: ["scopeRules"],
  },
);
assert.deepEqual(currentBuilderConfig, {
  result: {
    defaultMode: "table",
    pagination: true,
  },
  measures: [
    { id: "avails", label: "Avails" },
  ],
  dynamicFilterGroups: [
    {
      id: "scopeRules",
      label: "Scope Rules",
    },
  ],
  pinnedDynamicGroupIds: ["scopeRules"],
});

assert.deepEqual(
  metrics.patchBuilderConfig({
    result: {
      defaultMode: "chart",
    },
  }),
  {
    ...currentBuilderConfig,
    result: {
      defaultMode: "chart",
      pagination: true,
    },
  },
);
assert.deepEqual(currentBuilderConfig, {
  result: {
    defaultMode: "chart",
    pagination: true,
  },
  measures: [
    { id: "avails", label: "Avails" },
  ],
  dynamicFilterGroups: [
    {
      id: "scopeRules",
      label: "Scope Rules",
    },
  ],
  pinnedDynamicGroupIds: ["scopeRules"],
});

assert.deepEqual(metrics.patchBuilderState({
  viewMode: "table",
}), {
  ...restoredBuilderState,
  viewMode: "table",
});
assert.equal(currentWindowFormState.demoReportBuilder.viewMode, "table");
assert.deepEqual(lastPersistedBuilderState, {
  ...restoredBuilderState,
  viewMode: "table",
});

assert.deepEqual(metrics.getCollectionRows(), [{ country: "US", avails: 153100 }]);
assert.deepEqual(metrics.replaceCollectionRows([{ country: "CA", avails: 200 }], {
  hasMore: true,
  error: new Error("Preview failed."),
}), [{ country: "CA", avails: 200 }]);
assert.deepEqual(currentCollectionInfo, { hasMore: true });
assert.equal(currentControl.loading, false);
assert.match(String(currentControl.error?.message || ""), /Preview failed/);

assert.deepEqual(metrics.getSeededSavedReportPayloads(), currentSavedReportPayloads);
assert.deepEqual(
  metrics.patchSeededSavedReportPayload("forecastingLocationQ3", {
    compileState: {
      status: "invalid",
      diagnostics: [
        {
          code: "documentBlockColumnUnavailable",
          severity: "error",
          blockId: "primaryTable",
          path: "reportDocument.blocks.primaryTable.columns[0]",
          message: "Primary Table references unavailable table column 'country'.",
          suggestedFix: "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
        },
      ],
    },
  }),
  {
    reportDocument: {
      id: "forecastingLocationQ3",
      title: "Forecasting Location Q3",
    },
    compileState: {
      status: "invalid",
      diagnostics: [
        {
          code: "documentBlockColumnUnavailable",
          severity: "error",
          blockId: "primaryTable",
          path: "reportDocument.blocks.primaryTable.columns[0]",
          message: "Primary Table references unavailable table column 'country'.",
          suggestedFix: "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
        },
      ],
    },
  },
);
assert.equal(currentSavedReportPayloads[0].savedReportPayload.compileState.status, "invalid");
assert.equal(currentSavedReportPayloads[0].savedReportPayload.compileState.diagnostics[0].code, "documentBlockColumnUnavailable");
assert.equal(metrics.patchSeededSavedReportPayload("missingReport", {
  compileState: { status: "invalid" },
}), null);
assert.deepEqual(
  metrics.replaceSeededSavedReportPayloads([
    {
      reportDocument: {
        id: "forecastingReplacement",
      },
    },
  ]),
  [
    {
      reportDocument: {
        id: "forecastingReplacement",
      },
    },
  ],
);

assert.deepEqual(
  metrics.appendSeededSavedReportPayloadRecord({
    reportId: "forecastingAppended",
    title: "Forecasting Appended",
    documentVersion: 9,
  }),
  {
    savedReportPayload: {
      reportDocument: {
        id: "forecastingAppended",
        title: "Forecasting Appended",
      },
    },
    documentVersion: 9,
  },
);
assert.equal(currentSavedReportPayloads.length, 2);
assert.equal(currentSavedReportPayloads[1].savedReportPayload.reportDocument.id, "forecastingAppended");

const failingAppendMetrics = {};
attachPreviewRuntimeSurfaceApi(failingAppendMetrics, {
  getSavedReportPayloads() {
    return [];
  },
  setSavedReportPayloads() {},
  buildSavedReportPayloadRecord() {
    throw new Error("append failed");
  },
});
assert.equal(failingAppendMetrics.appendSeededSavedReportPayloadRecord({ reportId: "broken" }), null);

const invalidAppendMetrics = {};
attachPreviewRuntimeSurfaceApi(invalidAppendMetrics, {
  getSavedReportPayloads() {
    return [];
  },
  setSavedReportPayloads() {},
  buildSavedReportPayloadRecord() {
    return "invalid";
  },
});
assert.equal(invalidAppendMetrics.appendSeededSavedReportPayloadRecord({ reportId: "invalid" }), null);

currentSavedReportPayloads = [
  {
    reportDocument: {
      id: "forecastingBarePayload",
    },
    compileState: {
      status: "clean",
    },
  },
];

assert.deepEqual(
  metrics.patchSeededSavedReportPayload("forecastingBarePayload", {
    compileState: {
      status: "invalid",
      diagnostics: [
        {
          code: "documentBlockColumnUnavailable",
          severity: "error",
          message: "Missing table column.",
        },
      ],
    },
  }),
  {
    reportDocument: {
      id: "forecastingBarePayload",
    },
    compileState: {
      status: "invalid",
      diagnostics: [
        {
          code: "documentBlockColumnUnavailable",
          severity: "error",
          message: "Missing table column.",
        },
      ],
    },
  },
);
assert.equal(currentSavedReportPayloads[0].compileState.status, "invalid");
assert.equal(currentSavedReportPayloads[0].compileState.diagnostics[0].code, "documentBlockColumnUnavailable");

assert.deepEqual(
  metrics.replaceSeededSavedReportPayloads([
    {
      reportDocument: {
        id: "forecastingReplacement",
      },
    },
  ]),
  [
    {
      reportDocument: {
        id: "forecastingReplacement",
      },
    },
  ],
);

assert.equal(metrics.applyStandaloneRuntimeRefinement({
  op: "keep",
  field: "country",
  value: "US",
  sourceBlockId: "primaryChart",
  label: "Keep only = US",
}), true);
assert.deepEqual(appliedRefinement, {
  op: "keep",
  field: "country",
  value: "US",
  sourceBlockId: "primaryChart",
  label: "Keep only = US",
});
assert.equal(metrics.applyStandaloneRuntimeRefinement(null), false);

const replacedRuntimeInteraction = clearReportRuntimeInteractionDetailState(baseRuntimeInteraction);
assert.deepEqual(
  metrics.replaceStandaloneRuntimeInteraction(replacedRuntimeInteraction)?.reportDocumentReopenSession?.runtimePreviewInteraction,
  {
    refinements: baseRuntimeInteraction.refinements,
    drillTransitions: baseRuntimeInteraction.drillTransitions,
    hostIntent: null,
    detailDiagnostic: null,
  },
);
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), {
  refinements: baseRuntimeInteraction.refinements,
  drillTransitions: baseRuntimeInteraction.drillTransitions,
  hostIntent: null,
  detailDiagnostic: null,
});
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateId, "forecast_location_brief");
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateLabel, "Forecast Location Brief");

assert.deepEqual(
  metrics.advanceStandaloneRuntimeInteraction((currentSnapshot = null) => (
    applyReportRuntimeInteractionDrillTransition(currentSnapshot, {
      refinement: {
        op: "drill",
        field: "region",
        value: "US/West",
        sourceBlockId: "primaryTable",
        label: "Drill to Metro = West",
      },
      sourceField: "region",
      nextFieldRef: "metrocode",
      sourceBlockId: "primaryTable",
    })
  ))?.reportDocumentReopenSession?.runtimePreviewInteraction,
  {
    refinements: [
      ...baseRuntimeInteraction.refinements,
      {
        id: "drill:region:primaryTable",
        op: "drill",
        field: "region",
        values: ["US/West"],
        sourceBlockId: "primaryTable",
        label: "Drill to Metro = West",
      },
    ],
    drillTransitions: [
      ...baseRuntimeInteraction.drillTransitions,
      {
        refinementId: "drill:region:primaryTable",
        sourceField: "region",
        nextFieldRef: "metrocode",
        sourceBlockId: "primaryTable",
      },
    ],
    hostIntent: null,
    detailDiagnostic: null,
  },
);
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction?.drillTransitions?.length, 2);
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateId, "forecast_location_brief");
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateLabel, "Forecast Location Brief");

currentWindowFormState = {
  demoReportBuilder: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["country"],
    viewMode: "chart",
    reportDocumentReopenSession: {
      reportId: "marketEfficiencyBriefQ3",
      title: "Market Efficiency Brief Q3",
      documentVersion: 12,
      templateId: "market_efficiency_brief",
      templateLabel: "Market Efficiency Brief",
      source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
      },
      reopenedConfig: {
        result: {
          defaultMode: "chart",
        },
      },
      reopenedSemanticSummary: {
        kind: "semantic",
        modelRef: "model://steward/performance/ad_delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [],
        selectedMeasures: [],
      },
      reopenedSemanticFingerprint: "{\"fingerprint\":true}",
      runtimePreviewInteraction: marketEfficiencyRuntimeInteraction,
      liveSnapshot: {
        config: {
          result: {
            defaultMode: "table",
          },
        },
        state: {
          selectedDimensions: ["country"],
          viewMode: "chart",
        },
      },
    },
  },
};
lastPersistedBuilderState = null;
standaloneUndoSnapshot = {
  refinements: [
    {
      id: "drill:country:reachRateTrend",
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
  ],
  drillTransitions: [
    {
      refinementId: "drill:country:reachRateTrend",
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "reachRateTrend",
    },
  ],
  hostIntent: null,
  detailDiagnostic: null,
};
standaloneRedoSnapshot = marketEfficiencyRuntimeInteraction;
standaloneCanUndo = true;
standaloneCanRedo = false;
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), marketEfficiencyRuntimeInteraction);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: true,
  canRedo: false,
});
assert.deepEqual(
  metrics.replaceStandaloneRuntimeInteraction(marketEfficiencyRuntimeInteraction)?.reportDocumentReopenSession?.runtimePreviewInteraction,
  marketEfficiencyRuntimeInteraction,
);
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateId, "market_efficiency_brief");
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateLabel, "Market Efficiency Brief");
assert.deepEqual(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction, marketEfficiencyRuntimeInteraction);

lastPersistedBuilderState = null;
assert.deepEqual(
  metrics.undoStandaloneRuntimeInteraction()?.reportDocumentReopenSession?.runtimePreviewInteraction,
  standaloneUndoSnapshot,
);
assert.equal(undoInteractionCount, 1);
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), standaloneUndoSnapshot);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: false,
  canRedo: true,
});
assert.deepEqual(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction, standaloneUndoSnapshot);

lastPersistedBuilderState = null;
assert.deepEqual(
  metrics.redoStandaloneRuntimeInteraction()?.reportDocumentReopenSession?.runtimePreviewInteraction,
  marketEfficiencyRuntimeInteraction,
);
assert.equal(redoInteractionCount, 1);
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), marketEfficiencyRuntimeInteraction);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: true,
  canRedo: false,
});
assert.deepEqual(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction, marketEfficiencyRuntimeInteraction);

assert.equal(metrics.clearStandaloneRuntimeInteractions(), true);
assert.equal(clearInteractionCount, 1);
assert.equal(metrics.clearStandaloneRuntimeDetailState(), true);
assert.equal(clearDetailCount, 1);

const invalidMetrics = {};
attachPreviewRuntimeSurfaceApi(invalidMetrics, {
  getWindowFormState() {
    return currentWindowFormState;
  },
  stateKey: "",
});
assert.equal(invalidMetrics.getBuilderState(), null);
assert.equal(invalidMetrics.patchBuilderState({ viewMode: "table" }), null);
assert.equal(invalidMetrics.applyStandaloneRuntimeRefinement({
  op: "keep",
  field: "country",
  value: "US",
}), false);

const malformedWindowFormMetrics = {};
attachPreviewRuntimeSurfaceApi(malformedWindowFormMetrics, {
  getWindowFormState() {
    return "invalid";
  },
  stateKey: "demoReportBuilder",
});
assert.equal(malformedWindowFormMetrics.patchBuilderState({ viewMode: "table" }), null);

const malformedBuilderConfigMetrics = {};
attachPreviewRuntimeSurfaceApi(malformedBuilderConfigMetrics, {
  getBuilderConfig() {
    return "invalid";
  },
});
assert.equal(malformedBuilderConfigMetrics.patchBuilderConfig({ result: { defaultMode: "chart" } }), null);

detachPreviewRuntimeSurfaceApi(metrics);
assert.equal(metrics.getBuilderConfig, undefined);
assert.equal(metrics.patchBuilderConfig, undefined);
assert.equal(metrics.getBuilderState, undefined);
assert.equal(metrics.patchBuilderState, undefined);
assert.equal(metrics.getCollectionRows, undefined);
assert.equal(metrics.replaceCollectionRows, undefined);
assert.equal(metrics.applyStandaloneRuntimeRefinement, undefined);
assert.equal(metrics.getSeededSavedReportPayloads, undefined);
assert.equal(metrics.replaceSeededSavedReportPayloads, undefined);
assert.equal(metrics.appendSeededSavedReportPayloadRecord, undefined);
assert.equal(metrics.patchSeededSavedReportPayload, undefined);
assert.equal(metrics.getStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.replaceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.advanceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.clearStandaloneRuntimeInteractions, undefined);
assert.equal(metrics.clearStandaloneRuntimeDetailState, undefined);
assert.equal(metrics.getStandaloneRuntimeHistoryCapabilities, undefined);
assert.equal(metrics.undoStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.redoStandaloneRuntimeInteraction, undefined);

console.log("previewRuntimeSurfaceApi ✓ exposes builder, collection, and runtime controls for restored standalone preview sessions");
