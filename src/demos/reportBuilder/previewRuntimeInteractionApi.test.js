import assert from "node:assert/strict";

import {
  applyReportRuntimeInteractionDrillTransition,
  clearReportRuntimeInteractionDetailState,
} from "../../components/dashboard/reportRuntimeInteractionStateModel.js";
import {
  attachPreviewRuntimeInteractionApi,
  detachPreviewRuntimeInteractionApi,
} from "./previewRuntimeInteractionApi.js";

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

const marketEfficiencyDrillOnlyRuntimeInteraction = {
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

const restoredBuilderState = {
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

const windowFormState = {
  demoReportBuilder: restoredBuilderState,
  sibling: {
    untouched: true,
  },
};

let currentWindowFormState = windowFormState;
let lastPersistedBuilderState = null;
let clearInteractionCount = 0;
let clearDetailCount = 0;
let undoInteractionCount = 0;
let redoInteractionCount = 0;
let standaloneUndoSnapshot = baseRuntimeInteraction;
let standaloneRedoSnapshot = baseRuntimeInteraction;
let standaloneCanUndo = false;
let standaloneCanRedo = false;
let replacedRuntimeInteraction = "sentinel";
const metrics = {};

attachPreviewRuntimeInteractionApi(metrics, {
  getWindowFormState() {
    return currentWindowFormState;
  },
  setWindowFormState(nextState) {
    currentWindowFormState = nextState;
  },
  persistBuilderState(nextBuilderState) {
    lastPersistedBuilderState = nextBuilderState;
  },
  runtimeSurface: {
    get canUndoInteraction() {
      return standaloneCanUndo;
    },
    get canRedoInteraction() {
      return standaloneCanRedo;
    },
    replaceInteractionState(nextInteraction) {
      replacedRuntimeInteraction = nextInteraction;
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
});

assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), baseRuntimeInteraction);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: false,
  canRedo: false,
});

const replacedRuntimeInteractionSnapshot = clearReportRuntimeInteractionDetailState(baseRuntimeInteraction);
assert.deepEqual(
  metrics.replaceStandaloneRuntimeInteraction(replacedRuntimeInteractionSnapshot)?.reportDocumentReopenSession?.runtimePreviewInteraction,
  {
    refinements: baseRuntimeInteraction.refinements,
    drillTransitions: baseRuntimeInteraction.drillTransitions,
    hostIntent: null,
    detailDiagnostic: null,
  },
);
assert.deepEqual(
  lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction,
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
assert.deepEqual(replacedRuntimeInteraction, {
  refinements: baseRuntimeInteraction.refinements,
  drillTransitions: baseRuntimeInteraction.drillTransitions,
  hostIntent: null,
  detailDiagnostic: null,
});

currentWindowFormState = windowFormState;
lastPersistedBuilderState = null;
assert.equal(metrics.clearStandaloneRuntimeDetailState(), true);
assert.deepEqual(
  lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction,
  {
    refinements: baseRuntimeInteraction.refinements,
    drillTransitions: baseRuntimeInteraction.drillTransitions,
    hostIntent: null,
    detailDiagnostic: null,
  },
);

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
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), {
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
});
assert.deepEqual(replacedRuntimeInteraction, {
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
});

assert.equal(metrics.clearStandaloneRuntimeInteractions(), true);
assert.equal(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction, undefined);
assert.equal(clearInteractionCount, 1);
assert.equal(clearDetailCount, 1);

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
replacedRuntimeInteraction = "sentinel";
standaloneUndoSnapshot = marketEfficiencyDrillOnlyRuntimeInteraction;
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
assert.deepEqual(replacedRuntimeInteraction, marketEfficiencyRuntimeInteraction);

lastPersistedBuilderState = null;
replacedRuntimeInteraction = "sentinel";
assert.deepEqual(
  metrics.undoStandaloneRuntimeInteraction()?.reportDocumentReopenSession?.runtimePreviewInteraction,
  marketEfficiencyDrillOnlyRuntimeInteraction,
);
assert.equal(undoInteractionCount, 1);
assert.deepEqual(metrics.getStandaloneRuntimeInteraction(), marketEfficiencyDrillOnlyRuntimeInteraction);
assert.deepEqual(metrics.getStandaloneRuntimeHistoryCapabilities(), {
  canUndo: false,
  canRedo: true,
});
assert.deepEqual(lastPersistedBuilderState?.reportDocumentReopenSession?.runtimePreviewInteraction, marketEfficiencyDrillOnlyRuntimeInteraction);
assert.deepEqual(replacedRuntimeInteraction, "sentinel");

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
assert.deepEqual(replacedRuntimeInteraction, "sentinel");

const missingMetrics = {};
attachPreviewRuntimeInteractionApi(missingMetrics, {
  stateKey: "demoReportBuilder",
});
assert.equal(missingMetrics.clearStandaloneRuntimeInteractions(), false);
assert.equal(missingMetrics.clearStandaloneRuntimeDetailState(), false);
assert.equal(missingMetrics.undoStandaloneRuntimeInteraction(), false);
assert.equal(missingMetrics.redoStandaloneRuntimeInteraction(), false);

detachPreviewRuntimeInteractionApi(metrics);
assert.equal(metrics.getStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.getStandaloneRuntimeHistoryCapabilities, undefined);
assert.equal(metrics.replaceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.advanceStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.clearStandaloneRuntimeInteractions, undefined);
assert.equal(metrics.clearStandaloneRuntimeDetailState, undefined);
assert.equal(metrics.undoStandaloneRuntimeInteraction, undefined);
assert.equal(metrics.redoStandaloneRuntimeInteraction, undefined);

console.log("previewRuntimeInteractionApi ✓ exposes replace, advance, and clear helpers for restored standalone runtime sessions");
