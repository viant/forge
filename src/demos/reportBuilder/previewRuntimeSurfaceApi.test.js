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
    targetRef: "target://example/performance/market-detail",
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
    reportId: "capacityLocationsTopMarketsQ3",
    title: "Capacity Locations Top Markets Q3",
    documentVersion: 8,
    templateId: "capacity_location_brief",
    templateLabel: "Capacity Location Brief",
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
      modelRef: "model://example/performance/delivery@v1",
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
  dimensions: [
    { id: "publisher", label: "Publisher" },
    { id: "country", label: "Country" },
  ],
};
let currentCollectionRows = [{ country: "US", avails: 153100 }];
let currentCollectionInfo = { hasMore: false };
let currentControl = { loading: false, error: null };
let currentSavedReportPayloads = [
  {
    savedReportPayload: {
      reportDocument: {
        id: "capacityLocationQ3",
        title: "Capacity Location Q3",
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
let currentPreparedListReportDocumentsResponse = {
  version: 1,
  kind: "listReportDocumentsResponse",
  entries: [
    {
      reportRef: { reportId: "capacityLocationQ3" },
      documentVersion: 8,
      title: "Capacity Location Q3",
    },
  ],
  cursor: "",
  hasMore: false,
};
let currentPreparedListReportDocumentsSelectedEntryKey = "capacityLocationQ3";
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
let semanticModelProviderAvailable = true;
const metrics = {};

attachPreviewRuntimeSurfaceApi(metrics, {
  getBuilderConfig() {
    return currentBuilderConfig;
  },
  setBuilderConfig(nextBuilderConfig) {
    currentBuilderConfig = nextBuilderConfig;
  },
  getSemanticModelProviderAvailable() {
    return semanticModelProviderAvailable;
  },
  setSemanticModelProviderAvailable(enabled) {
    semanticModelProviderAvailable = enabled === true;
    return semanticModelProviderAvailable;
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
          id: seed.reportId || "capacityAppended",
          title: seed.title || "Capacity Appended",
        },
      },
      documentVersion: Number(seed.documentVersion || 0) || 0,
    };
  },
  getPreparedListReportDocumentsResponse() {
    return currentPreparedListReportDocumentsResponse;
  },
  getPreparedListReportDocumentsSelectedEntryKey() {
    return currentPreparedListReportDocumentsSelectedEntryKey;
  },
  replacePreparedListReportDocumentsResponse(nextResponse, options = {}) {
    currentPreparedListReportDocumentsResponse = nextResponse;
    currentPreparedListReportDocumentsSelectedEntryKey = String(options?.selectedEntryKey || options?.selectedReportId || "").trim();
    return {
      response: currentPreparedListReportDocumentsResponse,
      selectedEntryKey: currentPreparedListReportDocumentsSelectedEntryKey,
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
assert.equal(metrics.getSemanticModelProviderAvailable(), true);
assert.equal(metrics.setSemanticModelProviderAvailable(false), false);
assert.equal(metrics.getSemanticModelProviderAvailable(), false);
assert.equal(metrics.setSemanticModelProviderAvailable(true), true);
assert.deepEqual(metrics.getHydratedReportDocumentSession(), restoredBuilderState.reportDocumentReopenSession);
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
  dimensions: [
    { id: "publisher", label: "Publisher" },
    { id: "country", label: "Country" },
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
  dimensions: [
    { id: "publisher", label: "Publisher" },
    { id: "country", label: "Country" },
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

const startedDraftState = metrics.beginStandaloneDraft({
  sourceLabel: "the current result state",
  patch: {
    __scenarioDraft: true,
  },
  nowMs: 1700000000000,
});

assert.equal(startedDraftState.explorationSession.sessionId, "rbexplore_1700000000000");
assert.equal(startedDraftState.explorationSession.sourceRef.kind, "reportBuilder.result");
assert.equal(startedDraftState.explorationSession.sourceRef.contextLabel, "the current result state");
assert.equal(startedDraftState.explorationSession.dirty, true);
assert.equal(Array.isArray(startedDraftState.explorationSession.history), true);
assert.equal(startedDraftState.explorationSession.history.length, 2);
assert.equal(startedDraftState.__scenarioDraft, true);
assert.equal(currentWindowFormState.demoReportBuilder.explorationSession.sessionId, "rbexplore_1700000000000");
assert.equal(currentWindowFormState.demoReportBuilder.__scenarioDraft, true);
assert.equal(lastPersistedBuilderState.explorationSession.sessionId, "rbexplore_1700000000000");
assert.equal(lastPersistedBuilderState.__scenarioDraft, true);

const startedTableRowDraftState = metrics.beginStandaloneDraft({
  sourceKind: "reportBuilder.tableRow",
  sourceContext: {
    label: "2026-05-01 • Display",
    metadata: {
      rowIndex: 0,
      dimensionValues: {
        eventDate: "2026-05-01",
        channelV2: "Display",
      },
    },
  },
  patch: {
    __scenarioTableRowDraft: true,
  },
  nowMs: 1700000001000,
});

assert.equal(startedTableRowDraftState.explorationSession.sourceRef.kind, "reportBuilder.tableRow");
assert.equal(startedTableRowDraftState.explorationSession.sourceRef.contextLabel, "2026-05-01 • Display");
assert.deepEqual(startedTableRowDraftState.explorationSession.sourceRef.context, {
  rowIndex: 0,
  dimensionValues: {
    eventDate: "2026-05-01",
    channelV2: "Display",
  },
});
assert.equal(startedTableRowDraftState.__scenarioTableRowDraft, true);

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
  metrics.patchSeededSavedReportPayload("capacityLocationQ3", {
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
      id: "capacityLocationQ3",
      title: "Capacity Location Q3",
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
        id: "capacityReplacement",
      },
    },
  ]),
  [
    {
      reportDocument: {
        id: "capacityReplacement",
      },
    },
  ],
);

assert.deepEqual(
  metrics.appendSeededSavedReportPayloadRecord({
    reportId: "capacityAppended",
    title: "Capacity Appended",
    documentVersion: 9,
  }),
  {
    savedReportPayload: {
      reportDocument: {
        id: "capacityAppended",
        title: "Capacity Appended",
      },
    },
    documentVersion: 9,
  },
);
assert.equal(currentSavedReportPayloads.length, 2);
assert.equal(currentSavedReportPayloads[1].savedReportPayload.reportDocument.id, "capacityAppended");

assert.deepEqual(metrics.getPreparedListReportDocumentsResponse(), currentPreparedListReportDocumentsResponse);
assert.equal(metrics.getPreparedListReportDocumentsSelectedEntryKey(), "capacityLocationQ3");
assert.deepEqual(
  metrics.replacePreparedListReportDocumentsResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
      {
        reportRef: { reportId: "capacityShared" },
        documentVersion: 9,
        title: "Capacity Shared",
      },
    ],
    cursor: "",
    hasMore: false,
  }, {
    selectedEntryKey: "capacityShared",
  }),
  {
    response: {
      version: 1,
      kind: "listReportDocumentsResponse",
      entries: [
        {
          reportRef: { reportId: "capacityShared" },
          documentVersion: 9,
          title: "Capacity Shared",
        },
      ],
      cursor: "",
      hasMore: false,
    },
    selectedEntryKey: "capacityShared",
  },
);
assert.equal(metrics.getPreparedListReportDocumentsSelectedEntryKey(), "capacityShared");
assert.equal(metrics.getPreparedListReportDocumentsResponse()?.entries?.[0]?.reportRef?.reportId, "capacityShared");

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
      id: "capacityBarePayload",
    },
    compileState: {
      status: "clean",
    },
  },
];

assert.deepEqual(
  metrics.patchSeededSavedReportPayload("capacityBarePayload", {
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
      id: "capacityBarePayload",
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

const addedMarkdownBlock = metrics.applyAuthoredDocumentBlock({
  kind: "markdownBlock",
  seed: {
    title: "Inventory Note",
    markdown: "## Inventory Note\nAuthor-provided inventory context.",
  },
});

assert.equal(addedMarkdownBlock.valid, true);
assert.equal(addedMarkdownBlock.created, true);
assert.equal(addedMarkdownBlock.block.title, "Inventory Note");
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.at(-1).title, "Inventory Note");

const addedSecondMarkdownBlock = metrics.applyAuthoredDocumentBlock({
  kind: "markdownBlock",
  seed: {
    title: "Inventory Note Follow-up",
    markdown: "## Inventory Note Follow-up\nSecond authored note.",
  },
});

assert.equal(addedSecondMarkdownBlock.valid, true);
assert.equal(addedSecondMarkdownBlock.created, true);
assert.equal(addedSecondMarkdownBlock.block.id, "markdownBlock2");
assert.equal(addedSecondMarkdownBlock.block.title, "Inventory Note Follow-up");
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.some((block) => block.id === "markdownBlock2"), true);

const addedKpiBlock = metrics.applyAuthoredDocumentBlock({
  kind: "kpiBlock",
  seed: {
    title: "Reach KPI",
  },
});

assert.equal(addedKpiBlock.valid, true);
assert.equal(addedKpiBlock.created, true);
assert.equal(addedKpiBlock.block.title, "Reach KPI");
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.at(-1).title, "Reach KPI");

const addedSecondKpiBlock = metrics.applyAuthoredDocumentBlock({
  kind: "kpiBlock",
  seed: {
    title: "Reach KPI Follow-up",
  },
});

assert.equal(addedSecondKpiBlock.valid, true);
assert.equal(addedSecondKpiBlock.created, true);
assert.equal(addedSecondKpiBlock.block.id, "kpiBlock2");
assert.equal(addedSecondKpiBlock.block.title, "Reach KPI Follow-up");
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.some((block) => block.id === "kpiBlock2"), true);

const movedKpiBlock = metrics.moveAuthoredDocumentBlock("kpiBlock", "up");
assert.equal(Array.isArray(movedKpiBlock.reportDocumentLayout.items), true);
assert.deepEqual(
  currentWindowFormState.demoReportBuilder.reportDocumentLayout.items.map((item) => item.blockId),
  ["primaryBuilder", "markdownBlock", "kpiBlock", "markdownBlock2", "kpiBlock2"],
);

const duplicatedMarkdownBlock = metrics.duplicateAuthoredDocumentBlock("markdownBlock");
assert.equal(duplicatedMarkdownBlock.valid, true);
assert.equal(duplicatedMarkdownBlock.block.title, "Inventory Note Copy");
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.some((block) => block.title === "Inventory Note Copy"), true);

const removedMarkdownBlock = metrics.removeAuthoredDocumentBlock("markdownBlock");
assert.equal(Array.isArray(removedMarkdownBlock.reportDocumentBlocks), true);
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.some((block) => block.id === "markdownBlock"), false);
assert.equal(currentWindowFormState.demoReportBuilder.reportDocumentBlocks.some((block) => block.id === "markdownBlock2"), true);

const addedChartBlock = metrics.applyAuthoredDocumentBlock({
  kind: "chartBlock",
  seed: {
    title: "Reach Chart",
  },
});

assert.equal(addedChartBlock.valid, true);
assert.equal(addedChartBlock.created, true);
assert.equal(addedChartBlock.block.id, "chartBlock");
assert.equal(addedChartBlock.block.title, "Reach Chart");
assert.deepEqual(addedChartBlock.block.chartSpec, {
  title: "Reach Chart",
  type: "line",
  xField: "country",
  yFields: ["avails"],
  seriesField: "publisher",
});

assert.deepEqual(
  metrics.replaceSeededSavedReportPayloads([
    {
      reportDocument: {
        id: "capacityReplacement",
      },
    },
  ]),
  [
    {
      reportDocument: {
        id: "capacityReplacement",
      },
    },
  ],
);

let calculatedFieldWindowFormState = {
  demoReportBuilder: {
    selectedMeasures: ["avails"],
    selectedDimensions: ["country"],
    viewMode: "chart",
    reportDocumentReopenSession: {
      reportId: "capacityLocationsTopMarketsQ3",
      title: "Capacity Locations Top Markets Q3",
      documentVersion: 8,
      source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
      },
    },
  },
};
let calculatedFieldPersistedState = null;
const calculatedFieldMetrics = {};
attachPreviewRuntimeSurfaceApi(calculatedFieldMetrics, {
  getBuilderConfig() {
    return {
      result: {
        defaultMode: "table",
      },
      measures: [
        { id: "avails", label: "Avails" },
      ],
      dimensions: [
        { id: "country", label: "Country" },
      ],
    };
  },
  getWindowFormState() {
    return calculatedFieldWindowFormState;
  },
  setWindowFormState(nextWindowFormState) {
    calculatedFieldWindowFormState = nextWindowFormState;
  },
  stateKey: "demoReportBuilder",
  persistBuilderState(nextBuilderState) {
    calculatedFieldPersistedState = nextBuilderState;
  },
});

const addedLocalCalculatedField = calculatedFieldMetrics.applyLocalCalculatedField({
  draft: {
    id: "usAvails",
    label: "US Avails",
    expr: "if(country = 'US', avails, null)",
  },
});
const appliedCalculatedFieldState = calculatedFieldMetrics.getBuilderState();

assert.equal(addedLocalCalculatedField.valid, true);
assert.equal(addedLocalCalculatedField.field.id, "usAvails");
assert.equal(addedLocalCalculatedField.field.label, "US Avails");
assert.equal(addedLocalCalculatedField.nextState.localCalculatedFields.at(-1).id, "usAvails");
assert.equal(addedLocalCalculatedField.nextState.localCalculatedFields.at(-1).expr, "if(country = 'US', avails, null)");
assert.equal(addedLocalCalculatedField.nextState.selectedMeasures.includes("usAvails"), true);
assert.equal(addedLocalCalculatedField.nextState.primaryMeasure, "usAvails");
assert.equal(appliedCalculatedFieldState.localCalculatedFields.at(-1).id, "usAvails");
assert.equal(appliedCalculatedFieldState.explorationSession?.sourceRef?.kind, "reportBuilder.result");
assert.equal(appliedCalculatedFieldState.explorationSession?.sourceRef?.contextLabel, "US Avails");
assert.equal(appliedCalculatedFieldState.explorationSession?.dirty, true);
assert.equal(Array.isArray(appliedCalculatedFieldState.explorationSession?.history), true);
assert.equal(appliedCalculatedFieldState.explorationSession.history.length, 2);
assert.equal(calculatedFieldPersistedState.localCalculatedFields.at(-1).id, "usAvails");
assert.equal(calculatedFieldPersistedState.explorationSession?.sourceRef?.contextLabel, "US Avails");

const addedDependentCalculatedField = calculatedFieldMetrics.applyLocalCalculatedField({
  draft: {
    id: "doubleUsAvails",
    label: "Double US Avails",
    expr: "if(usAvails = null, null, usAvails * 2)",
  },
});
const dependentCalculatedFieldState = calculatedFieldMetrics.getBuilderState();

assert.equal(addedDependentCalculatedField.valid, true);
assert.equal(addedDependentCalculatedField.field.id, "doubleUsAvails");
assert.equal(addedDependentCalculatedField.nextState.localCalculatedFields.at(-1).id, "doubleUsAvails");
assert.equal(
  dependentCalculatedFieldState.localCalculatedFields.some((entry) => entry?.id === "doubleUsAvails" && entry?.expr === "if(usAvails = null, null, usAvails * 2)"),
  true,
);

const editedCalculatedField = calculatedFieldMetrics.applyLocalCalculatedField({
  editingId: "usAvails",
  draft: {
    id: "usAvails",
    label: "US Avails Updated",
    expr: "if(country = 'US', avails, null)",
  },
});
const editedCalculatedFieldState = calculatedFieldMetrics.getBuilderState();

assert.equal(editedCalculatedField.valid, true);
assert.equal(editedCalculatedField.field.label, "US Avails Updated");
assert.equal(
  editedCalculatedFieldState.localCalculatedFields.some((entry) => entry?.id === "usAvails" && entry?.label === "US Avails Updated"),
  true,
);

const addedTableCalculation = calculatedFieldMetrics.applyLocalTableCalculationDraft({
  draft: {
    id: "runningUsAvails",
    label: "Running US Avails",
    functionId: "runningTotal",
    sourceField: "usAvails",
    orderByField: "country",
    orderDir: "asc",
  },
});
const appliedTableCalculationState = calculatedFieldMetrics.getBuilderState();

assert.equal(addedTableCalculation.valid, true);
assert.equal(addedTableCalculation.field.id, "runningUsAvails");
assert.equal(addedTableCalculation.prepared.canApply, true);
assert.equal(addedTableCalculation.prepared.nextState.viewMode, "table");
assert.equal(
  appliedTableCalculationState.localTableCalculations.some((entry) => entry?.id === "runningUsAvails" && entry?.compute?.type === "runningTotal" && entry?.compute?.sourceField === "usAvails"),
  true,
);
assert.equal(appliedTableCalculationState.selectedMeasures.includes("runningUsAvails"), true);
assert.equal(appliedTableCalculationState.explorationSession?.dirty, true);
assert.equal(appliedTableCalculationState.explorationSession?.historyIndex, 1);

const editedTableCalculation = calculatedFieldMetrics.applyLocalTableCalculationDraft({
  editingId: "runningUsAvails",
  draft: {
    id: "runningUsAvails",
    label: "Running US Avails Edited",
    functionId: "runningTotal",
    sourceField: "usAvails",
    orderByField: "country",
    orderDir: "asc",
  },
});
const editedTableCalculationState = calculatedFieldMetrics.getBuilderState();

assert.equal(editedTableCalculation.valid, true);
assert.equal(
  editedTableCalculationState.localTableCalculations.some((entry) => entry?.id === "runningUsAvails" && entry?.label === "Running US Avails Edited"),
  true,
);

const removedTableCalculationState = calculatedFieldMetrics.removeLocalTableCalculation("runningUsAvails");
const postRemovalTableCalculationState = calculatedFieldMetrics.getBuilderState();

assert.equal(
  Array.isArray(removedTableCalculationState?.localTableCalculations)
    && !removedTableCalculationState.localTableCalculations.some((entry) => entry?.id === "runningUsAvails"),
  true,
);
assert.equal(
  !postRemovalTableCalculationState.localTableCalculations.some((entry) => entry?.id === "runningUsAvails"),
  true,
);

const quickTableCalculationWindowFormState = {
  demoReportBuilder: {
    selectedMeasures: ["hhUniqs"],
    primaryMeasure: "hhUniqs",
    selectedDimensions: ["country"],
    viewMode: "chart",
  },
};
let quickTableCalculationPersistedState = null;
const quickTableCalculationMetrics = {};
attachPreviewRuntimeSurfaceApi(quickTableCalculationMetrics, {
  getBuilderConfig() {
    return {
      result: {
        defaultMode: "chart",
        pageSize: 50,
      },
      measures: [
        { id: "hhUniqs", label: "HH Uniques" },
      ],
      dimensions: [
        { id: "eventDate", label: "Date" },
        { id: "channelV2", label: "Channel" },
        { id: "country", label: "Market" },
      ],
      tableCalculations: [
        {
          id: "reachRank",
          key: "reachRank",
          label: "Reach Rank",
          format: "number",
          compute: {
            type: "rank",
            sourceField: "hhUniqs",
            orderBy: [
              { field: "hhUniqs", direction: "desc" },
              { field: "country", direction: "asc" },
              { field: "channelV2", direction: "asc" },
              { field: "eventDate", direction: "asc" },
            ],
          },
        },
      ],
    };
  },
  getWindowFormState() {
    return quickTableCalculationWindowFormState;
  },
  setWindowFormState(nextWindowFormState) {
    quickTableCalculationWindowFormState.demoReportBuilder = nextWindowFormState.demoReportBuilder;
  },
  stateKey: "demoReportBuilder",
  persistBuilderState(nextBuilderState) {
    quickTableCalculationPersistedState = nextBuilderState;
  },
});

const quickRankTableCalculation = quickTableCalculationMetrics.applyQuickTableCalculation("reachRank");
const quickRankState = quickTableCalculationMetrics.getBuilderState();

assert.equal(quickRankTableCalculation.valid, true);
assert.equal(quickRankTableCalculation.field.id, "reachRank");
assert.equal(quickRankTableCalculation.prepared.canApply, true);
assert.deepEqual(quickRankTableCalculation.prepared.requiredDimensionIds, ["country", "channelV2", "eventDate"]);
assert.equal(quickRankState.selectedMeasures.includes("reachRank"), true);
assert.deepEqual(quickRankState.selectedDimensions, ["country", "channelV2", "eventDate"]);
assert.equal(quickRankState.primaryMeasure, "reachRank");
assert.equal(quickRankState.viewMode, "table");
assert.equal(
  quickRankState.localTableCalculations.some((entry) => entry?.id === "reachRank" && entry?.compute?.type === "rank" && entry?.compute?.sourceField === "hhUniqs"),
  true,
);
assert.equal(quickTableCalculationPersistedState.localTableCalculations.at(-1).id, "reachRank");

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
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateId, "capacity_location_brief");
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateLabel, "Capacity Location Brief");

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
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateId, "capacity_location_brief");
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.templateLabel, "Capacity Location Brief");

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
        modelRef: "model://example/performance/delivery@v1",
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
assert.deepEqual(metrics.getHydratedReportDocumentSession(), currentWindowFormState.demoReportBuilder.reportDocumentReopenSession);
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
assert.equal(invalidMetrics.getHydratedReportDocumentSession(), null);
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
assert.equal(malformedBuilderConfigMetrics.applyLocalCalculatedField({
  draft: {
    id: "broken",
    label: "Broken",
    expr: "avails",
  },
}), null);
assert.equal(malformedBuilderConfigMetrics.applyLocalTableCalculationDraft({
  draft: {
    id: "brokenTableCalc",
    label: "Broken Table Calc",
    functionId: "runningTotal",
    sourceField: "avails",
    orderByField: "country",
  },
}), null);
assert.equal(malformedBuilderConfigMetrics.applyQuickTableCalculation("reachRank"), null);
assert.equal(malformedBuilderConfigMetrics.removeLocalTableCalculation("brokenTableCalc"), null);

detachPreviewRuntimeSurfaceApi(metrics);
assert.equal(metrics.getBuilderConfig, undefined);
assert.equal(metrics.getSemanticModelProviderAvailable, undefined);
assert.equal(metrics.setSemanticModelProviderAvailable, undefined);
assert.equal(metrics.patchBuilderConfig, undefined);
assert.equal(metrics.getBuilderState, undefined);
assert.equal(metrics.getHydratedReportDocumentSession, undefined);
assert.equal(metrics.patchBuilderState, undefined);
assert.equal(metrics.beginStandaloneDraft, undefined);
assert.equal(metrics.applyAuthoredDocumentBlock, undefined);
assert.equal(metrics.applyLocalCalculatedField, undefined);
assert.equal(metrics.applyLocalTableCalculationDraft, undefined);
assert.equal(metrics.applyQuickTableCalculation, undefined);
assert.equal(metrics.removeLocalTableCalculation, undefined);
assert.equal(metrics.duplicateAuthoredDocumentBlock, undefined);
assert.equal(metrics.moveAuthoredDocumentBlock, undefined);
assert.equal(metrics.removeAuthoredDocumentBlock, undefined);
assert.equal(metrics.getCollectionRows, undefined);
assert.equal(metrics.replaceCollectionRows, undefined);
assert.equal(metrics.applyStandaloneRuntimeRefinement, undefined);
assert.equal(metrics.getSeededSavedReportPayloads, undefined);
assert.equal(metrics.replaceSeededSavedReportPayloads, undefined);
assert.equal(metrics.appendSeededSavedReportPayloadRecord, undefined);
assert.equal(metrics.patchSeededSavedReportPayload, undefined);
assert.equal(metrics.getPreparedListReportDocumentsResponse, undefined);
assert.equal(metrics.getPreparedListReportDocumentsSelectedEntryKey, undefined);
assert.equal(metrics.replacePreparedListReportDocumentsResponse, undefined);
assert.equal(metrics.getStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.replaceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.advanceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.clearStandaloneRuntimeInteractions, undefined);
assert.equal(metrics.clearStandaloneRuntimeDetailState, undefined);
assert.equal(metrics.getStandaloneRuntimeHistoryCapabilities, undefined);
assert.equal(metrics.undoStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.redoStandaloneRuntimeInteraction, undefined);

console.log("previewRuntimeSurfaceApi ✓ exposes builder, collection, and runtime controls for restored standalone preview sessions");
