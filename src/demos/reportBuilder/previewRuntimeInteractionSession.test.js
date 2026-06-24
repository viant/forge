import assert from "node:assert/strict";

import {
  buildPreviewRuntimeInteractionAdvancedWindowState,
  buildPreviewRuntimeInteractionAdvancedState,
  buildPreviewHydratedRuntimeInteractionSnapshot,
  buildPreviewRuntimeInteractionFingerprint,
  buildPreviewRuntimeInteractionPersistedState,
  buildPreviewRuntimeInteractionPersistedStateFromBuilderState,
  buildPreviewRuntimeInteractionSnapshot,
  buildPreviewRuntimeInteractionWindowState,
} from "./previewRuntimeInteractionSession.js";
import {
  applyReportRuntimeInteractionDrillTransition,
  applyReportRuntimeInteractionRefinement,
  clearReportRuntimeInteractionDetailState,
} from "../../components/dashboard/reportRuntimeInteractionStateModel.js";

const runtimeInteraction = {
  refinements: [
    {
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

assert.equal(buildPreviewRuntimeInteractionSnapshot(null), null);
assert.deepEqual(buildPreviewRuntimeInteractionSnapshot(runtimeInteraction), {
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
});

const session = {
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
};

assert.equal(buildPreviewHydratedRuntimeInteractionSnapshot(session), null);
const sessionWithRuntimeInteraction = {
  ...session,
  runtimePreviewInteraction: runtimeInteraction,
};
assert.deepEqual(
  buildPreviewHydratedRuntimeInteractionSnapshot(sessionWithRuntimeInteraction),
  buildPreviewRuntimeInteractionSnapshot(runtimeInteraction),
);
assert.equal(
  buildPreviewRuntimeInteractionFingerprint(buildPreviewHydratedRuntimeInteractionSnapshot(sessionWithRuntimeInteraction)),
  buildPreviewRuntimeInteractionFingerprint(buildPreviewRuntimeInteractionSnapshot(runtimeInteraction)),
);

const persistedBuilderState = {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
};

assert.equal(buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState: null,
  hydratedReportDocumentSession: session,
  runtimeInteractionSnapshot: runtimeInteraction,
}), null);

assert.deepEqual(buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState,
  hydratedReportDocumentSession: session,
  runtimeInteractionSnapshot: runtimeInteraction,
}), {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: {
    ...session,
    runtimePreviewInteraction: buildPreviewRuntimeInteractionSnapshot(runtimeInteraction),
  },
});

assert.deepEqual(buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState,
  hydratedReportDocumentSession: sessionWithRuntimeInteraction,
  runtimeInteractionSnapshot: null,
}), {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: session,
});

const restoredWithRuntimeInteraction = buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState,
  hydratedReportDocumentSession: session,
  runtimeInteractionSnapshot: runtimeInteraction,
});
assert.deepEqual(
  buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
    persistedBuilderState: restoredWithRuntimeInteraction,
    runtimeInteractionSnapshot: runtimeInteraction,
  }),
  restoredWithRuntimeInteraction,
);

const resumedInteraction = applyReportRuntimeInteractionRefinement(
  clearReportRuntimeInteractionDetailState(
    buildPreviewRuntimeInteractionSnapshot(runtimeInteraction),
  ),
  {
    op: "keep",
    field: "region",
    value: "US/West",
    sourceBlockId: "primaryTable",
    label: "Keep only = West",
  },
);

assert.deepEqual(buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
  persistedBuilderState: restoredWithRuntimeInteraction,
  runtimeInteractionSnapshot: resumedInteraction,
}), {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: {
    ...session,
    runtimePreviewInteraction: {
      refinements: [
        {
          id: "keep:country:primaryChart",
          op: "keep",
          field: "country",
          values: ["US"],
          sourceBlockId: "primaryChart",
          label: "Keep only = US",
        },
        {
          id: "keep:region:primaryTable",
          op: "keep",
          field: "region",
          values: ["US/West"],
          sourceBlockId: "primaryTable",
          label: "Keep only = West",
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
      hostIntent: null,
      detailDiagnostic: null,
    },
  },
});

assert.equal(buildPreviewRuntimeInteractionAdvancedState({
  persistedBuilderState,
  interactionUpdater() {
    return runtimeInteraction;
  },
}), null);

assert.deepEqual(buildPreviewRuntimeInteractionAdvancedState({
  persistedBuilderState: restoredWithRuntimeInteraction,
  interactionUpdater(currentSnapshot = null) {
    return applyReportRuntimeInteractionDrillTransition(currentSnapshot, {
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
    });
  },
}), {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: {
    ...session,
    runtimePreviewInteraction: {
      refinements: [
        {
          id: "keep:country:primaryChart",
          op: "keep",
          field: "country",
          values: ["US"],
          sourceBlockId: "primaryChart",
          label: "Keep only = US",
        },
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
        {
          refinementId: "keep:country:primaryChart",
          sourceField: "country",
          nextFieldRef: "region",
          sourceBlockId: "primaryChart",
        },
        {
          refinementId: "drill:region:primaryTable",
          sourceField: "region",
          nextFieldRef: "metrocode",
          sourceBlockId: "primaryTable",
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
    },
  },
});

const windowFormState = {
  demoReportBuilder: restoredWithRuntimeInteraction,
  sibling: {
    untouched: true,
  },
};

assert.deepEqual(buildPreviewRuntimeInteractionWindowState({
  windowFormState,
  stateKey: "demoReportBuilder",
  runtimeInteractionSnapshot: resumedInteraction,
}), {
  demoReportBuilder: buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
    persistedBuilderState: restoredWithRuntimeInteraction,
    runtimeInteractionSnapshot: resumedInteraction,
  }),
  sibling: {
    untouched: true,
  },
});

assert.equal(buildPreviewRuntimeInteractionWindowState({
  windowFormState,
  stateKey: "missingBuilder",
  runtimeInteractionSnapshot: resumedInteraction,
}), null);

assert.deepEqual(buildPreviewRuntimeInteractionAdvancedWindowState({
  windowFormState,
  stateKey: "demoReportBuilder",
  interactionUpdater(currentSnapshot = null) {
    return applyReportRuntimeInteractionDrillTransition(currentSnapshot, {
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
    });
  },
}), {
  demoReportBuilder: buildPreviewRuntimeInteractionAdvancedState({
    persistedBuilderState: restoredWithRuntimeInteraction,
    interactionUpdater(currentSnapshot = null) {
      return applyReportRuntimeInteractionDrillTransition(currentSnapshot, {
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
      });
    },
  }),
  sibling: {
    untouched: true,
  },
});

assert.equal(buildPreviewRuntimeInteractionAdvancedWindowState({
  windowFormState,
  stateKey: "missingBuilder",
  interactionUpdater() {
    return resumedInteraction;
  },
}), null);

const mixedTemplateRuntimeInteraction = {
  refinements: [
    {
      op: "drill",
      field: "country",
      values: ["US"],
      sourceBlockId: "reachRateTrend",
      label: "Drill to Region = US",
    },
    {
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

const mixedTemplateSession = {
  ...session,
  reportId: "marketEfficiencyBriefQ3",
  title: "Market Efficiency Brief Q3",
  documentVersion: 12,
  templateId: "market_efficiency_brief",
  templateLabel: "Market Efficiency Brief",
};

assert.deepEqual(buildPreviewRuntimeInteractionSnapshot(mixedTemplateRuntimeInteraction), {
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
});

const mixedTemplatePersisted = buildPreviewRuntimeInteractionPersistedState({
  persistedBuilderState,
  hydratedReportDocumentSession: mixedTemplateSession,
  runtimeInteractionSnapshot: mixedTemplateRuntimeInteraction,
});
assert.deepEqual(mixedTemplatePersisted, {
  selectedMeasures: ["avails"],
  selectedDimensions: ["country"],
  viewMode: "chart",
  reportDocumentReopenSession: {
    ...mixedTemplateSession,
    runtimePreviewInteraction: buildPreviewRuntimeInteractionSnapshot(mixedTemplateRuntimeInteraction),
  },
});

assert.deepEqual(buildPreviewRuntimeInteractionPersistedStateFromBuilderState({
  persistedBuilderState: mixedTemplatePersisted,
  runtimeInteractionSnapshot: mixedTemplateRuntimeInteraction,
}), mixedTemplatePersisted);

console.log("previewRuntimeInteractionSession ✓ normalizes and persists standalone runtime interaction snapshots through reopened preview sessions");
