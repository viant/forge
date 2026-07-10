import assert from "node:assert/strict";

import {
  applySavedViewOverlayScopeParams,
  applySavedViewOverlayToBuilderState,
  buildSavedViewOverlaySummary,
  extractSavedViewOverlayArtifactState,
} from "./savedViewOverlayModel.js";

const savedViewArtifact = {
  version: 1,
  kind: "reportBuilder.savedView",
  id: "saved_view_capacity_q3_overlay",
  title: "Capacity Q3 Saved View Overlay",
  reportId: "capacityQ3",
  documentVersion: 8,
  document: {
    version: 1,
    kind: "reportDocument",
    id: "capacityQ3",
    title: "Capacity Q3",
    scope: {
      params: [
        { id: "dateRange", label: "Date Range" },
        { id: "channelsFilter", label: "Channels" },
      ],
    },
    blocks: [
      {
        id: "primaryBuilder",
        kind: "reportBuilderBlock",
        config: {
          staticFilters: [
            { id: "dateRange", type: "dateRange" },
            { id: "channelsFilter", type: "multiSelect" },
          ],
          dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date" },
            { id: "channelV2", key: "channelV2", label: "Channel" },
          ],
          measures: [
            { id: "avails", key: "avails", label: "Avails" },
          ],
          result: {
            orderFields: [
              { value: "avails", field: "avails", defaultDirection: "desc" },
            ],
            defaultTablePresets: [
              {
                id: "inventory_ladder",
                title: "Inventory Ladder",
                dimensions: ["eventDate", "channelV2"],
                measures: ["avails"],
                primaryMeasure: "avails",
                orderField: "avails",
                orderDir: "desc",
                pageSize: 20,
              },
            ],
          },
        },
        state: {
          selectedDimensions: ["eventDate", "channelV2"],
          selectedMeasures: ["avails"],
          primaryMeasure: "avails",
        },
        scopeBindings: [
          { paramId: "channelsFilter", target: "staticFilters.channelsFilter" },
        ],
      },
    ],
  },
  savedViewOverlay: {
    baseReportRef: {
      artifactRef: "report://capacityQ3",
      reportId: "capacityQ3",
      documentVersion: 7,
    },
    publishedSnapshotRef: {
      artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
      reportId: "capacityQ3",
      documentVersion: 8,
      sourceArtifactId: "published_snapshot_capacity_q3",
    },
    overlay: {
      filters: {
        dateRange: { start: "2026-05-01", end: "2026-05-04" },
      },
      parameters: {
        channelsFilter: ["CTV"],
      },
      order: {
        field: "avails",
        direction: "desc",
        pageSize: 20,
      },
      presentation: {
        viewMode: "table",
        activeTablePreset: "Inventory Ladder",
      },
    },
  },
};

assert.deepEqual(extractSavedViewOverlayArtifactState(savedViewArtifact), {
  baseReportRef: {
    artifactRef: "report://capacityQ3",
    reportId: "capacityQ3",
    documentVersion: 7,
  },
  publishedSnapshotRef: {
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
    reportId: "capacityQ3",
    documentVersion: 8,
    sourceArtifactId: "published_snapshot_capacity_q3",
  },
  overlay: {
    filters: {
      dateRange: { start: "2026-05-01", end: "2026-05-04" },
    },
    parameters: {
      channelsFilter: ["CTV"],
    },
    order: {
      field: "avails",
      direction: "desc",
      pageSize: 20,
    },
    presentation: {
      viewMode: "table",
      activeTablePreset: "Inventory Ladder",
    },
  },
});

const overlaySummary = buildSavedViewOverlaySummary(savedViewArtifact, {
  document: savedViewArtifact.document,
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    scope: {
      params: [
        { id: "dateRange", label: "Date Range" },
        { id: "channelsFilter", label: "Channels" },
      ],
    },
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true, channelV2: true },
          measures: { avails: true },
        },
      },
    ],
  },
});

assert.deepEqual(overlaySummary, {
  title: "Saved View Overlay",
  text: "1 filter • 1 parameter • Order avails desc • table view • Preset Inventory Ladder • Base v7 • Snapshot v8",
  chips: [
    "1 filter",
    "1 parameter",
    "Order avails desc",
    "table view",
    "Preset Inventory Ladder",
    "Base v7",
    "Snapshot v8",
  ],
  savedViewOverlay: extractSavedViewOverlayArtifactState(savedViewArtifact),
});

assert.deepEqual(applySavedViewOverlayScopeParams(savedViewArtifact, {
  scopeParams: [
    { id: "dateRange", label: "Date Range", value: { start: "2026-04-01", end: "2026-04-30" } },
    { id: "channelsFilter", label: "Channels", value: [] },
  ],
}), [
  { id: "dateRange", label: "Date Range", value: { start: "2026-04-01", end: "2026-04-30" } },
  { id: "channelsFilter", label: "Channels", value: ["CTV"] },
]);

assert.deepEqual(applySavedViewOverlayToBuilderState(savedViewArtifact, {
  document: savedViewArtifact.document,
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true, channelV2: true },
          measures: { avails: true },
        },
      },
    ],
  },
  state: {
    selectedDimensions: ["eventDate", "channelV2"],
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    scopeParams: {},
    orderField: "eventDate",
    orderDir: "asc",
    pageSize: 50,
    page: 1,
    viewMode: "chart",
    groupBy: "",
    chartSpec: null,
    activeTablePreset: null,
    lastTablePreset: null,
  },
}), {
  selectedDimensions: ["eventDate", "channelV2"],
  selectedMeasures: ["avails"],
  primaryMeasure: "avails",
  scopeParams: {
    dateRange: { start: "2026-05-01", end: "2026-05-04" },
  },
  orderField: "avails",
  orderDir: "desc",
  pageSize: 20,
  page: 1,
  viewMode: "table",
  groupBy: "",
  chartSpec: null,
  activeTablePreset: {
    id: "inventory_ladder",
    title: "Inventory Ladder",
    dimensions: ["eventDate", "channelV2"],
    measures: ["avails"],
    primaryMeasure: "avails",
    orderField: "avails",
    orderDir: "desc",
    pageSize: 20,
  },
  lastTablePreset: null,
});

assert.equal(buildSavedViewOverlaySummary({
  ...savedViewArtifact,
  document: {
    ...savedViewArtifact.document,
    blocks: [
      {
        ...savedViewArtifact.document.blocks[0],
        config: {
          ...savedViewArtifact.document.blocks[0].config,
          computedMeasures: [
            { id: "reachRate", key: "reachRate", label: "Reach Rate" },
          ],
          result: {
            ...savedViewArtifact.document.blocks[0].config.result,
            orderFields: [
              { value: "reachRate", field: "reachRate", defaultDirection: "desc" },
            ],
          },
        },
        state: {
          ...savedViewArtifact.document.blocks[0].state,
          selectedMeasures: ["reachRate"],
        },
      },
    ],
  },
  savedViewOverlay: {
    ...savedViewArtifact.savedViewOverlay,
    overlay: {
      order: {
        field: "reachRate",
        direction: "desc",
      },
    },
  },
}, {
  document: {
    ...savedViewArtifact.document,
    blocks: [
      {
        ...savedViewArtifact.document.blocks[0],
        config: {
          ...savedViewArtifact.document.blocks[0].config,
          computedMeasures: [
            { id: "reachRate", key: "reachRate", label: "Reach Rate" },
          ],
          result: {
            ...savedViewArtifact.document.blocks[0].config.result,
            orderFields: [
              { value: "reachRate", field: "reachRate", defaultDirection: "desc" },
            ],
          },
        },
        state: {
          ...savedViewArtifact.document.blocks[0].state,
          selectedMeasures: ["reachRate"],
        },
      },
    ],
  },
  reportSpec: savedViewArtifact.reportSpec,
})?.diagnostics, undefined);

assert.deepEqual(applySavedViewOverlayToBuilderState({
  ...savedViewArtifact,
  savedViewOverlay: {
    ...savedViewArtifact.savedViewOverlay,
    overlay: {
      order: {
        field: "missingField",
        direction: "desc",
        pageSize: 99,
        page: 3,
      },
    },
  },
}, {
  document: savedViewArtifact.document,
  reportSpec: savedViewArtifact.reportSpec,
  state: {
    orderField: "eventDate",
    orderDir: "asc",
    pageSize: 50,
    page: 1,
  },
}), {
  orderField: "eventDate",
  orderDir: "asc",
  pageSize: 50,
  page: 1,
});

const invalidOverlaySummary = buildSavedViewOverlaySummary({
  ...savedViewArtifact,
  savedViewOverlay: {
    baseReportRef: {
      artifactRef: "report://capacityQ3",
      reportId: "capacityQ3",
      documentVersion: 7,
    },
    overlay: {
      filters: {
        unknownFilter: true,
      },
      order: {
        field: "missingField",
        direction: "sideways",
      },
      presentation: {
        viewMode: "grid",
        unexpectedOption: true,
      },
      unsupportedDelta: true,
    },
  },
}, {
  document: savedViewArtifact.document,
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    scope: {
      params: [
        { id: "dateRange", label: "Date Range" },
      ],
    },
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true },
          measures: { avails: true },
        },
      },
    ],
  },
});

assert.equal(invalidOverlaySummary.chips.includes("6 overlay diagnostics"), true);
assert.deepEqual(
  invalidOverlaySummary.diagnostics.map((entry) => entry.code),
  [
    "savedViewOverlayUnsupportedKey",
    "savedViewOverlayInvalidOrderDirection",
    "savedViewOverlayUnsupportedPresentationKey",
    "savedViewOverlayInvalidViewMode",
    "savedViewOverlayUnknownFilter",
    "savedViewOverlayUnknownOrderField",
  ],
);

const mismatchedReferenceOverlaySummary = buildSavedViewOverlaySummary({
  ...savedViewArtifact,
  savedViewOverlay: {
    baseReportRef: {
      artifactRef: "report://capacityQ3",
      reportId: "capacityQ3",
      documentVersion: 9,
    },
    publishedSnapshotRef: {
      artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_other_report",
      reportId: "capacityOther",
      documentVersion: 8,
      sourceArtifactId: "published_snapshot_other_report",
    },
    overlay: {
      filters: {
        dateRange: { start: "2026-05-01", end: "2026-05-04" },
      },
    },
  },
}, {
  document: savedViewArtifact.document,
  reportSpec: savedViewArtifact.reportSpec,
});
assert.deepEqual(
  mismatchedReferenceOverlaySummary.diagnostics.map((entry) => entry.code),
  [
    "savedViewOverlaySnapshotBaseReportMismatch",
    "savedViewOverlaySnapshotBaseVersionStale",
  ],
);

// --- predicate-backed base reports: scopeParams.* bindings and predicate filter ids ---

const predicateSavedViewArtifact = {
  version: 1,
  kind: "reportBuilder.savedView",
  id: "saved_view_forecast_overlay",
  title: "Forecast Saved View Overlay",
  reportId: "forecastQ3",
  documentVersion: 3,
  document: {
    version: 1,
    kind: "reportDocument",
    id: "forecastQ3",
    title: "Forecast Q3",
    scope: {
      params: [
        { id: "dateRange", label: "Date Range" },
        { id: "channelIds", label: "Channels" },
      ],
    },
    blocks: [
      {
        id: "primaryBuilder",
        kind: "reportBuilderBlock",
        config: {
          predicates: [
            {
              id: "dateRange",
              label: "Date Range",
              kind: "dateRange",
              required: true,
              startParamPath: "filters.from",
              endParamPath: "filters.to",
            },
            {
              id: "channelIds",
              label: "Channels",
              pinned: true,
              multiple: true,
              paramPath: "filters.channelIds",
            },
            {
              id: "audienceIds",
              label: "Audience",
              bucket: "scope",
              paramPath: "filters.audienceIds",
            },
          ],
          dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date" },
          ],
          measures: [
            { id: "reach", key: "reach", label: "Reach" },
          ],
        },
        state: {
          selectedDimensions: ["eventDate"],
          selectedMeasures: ["reach"],
          primaryMeasure: "reach",
        },
        scopeBindings: [
          { paramId: "dateRange", target: "scopeParams.dateRange" },
          { paramId: "channelIds", target: "scopeParams.channelIds" },
        ],
      },
    ],
  },
  savedViewOverlay: {
    baseReportRef: {
      artifactRef: "report://forecastQ3",
      reportId: "forecastQ3",
      documentVersion: 3,
    },
    overlay: {
      filters: {
        dateRange: { start: "2026-06-01", end: "2026-06-07" },
        channelIds: [2, 9],
      },
      parameters: {
        channelIds: [2, 9],
      },
    },
  },
};

const predicateOverlaySummary = buildSavedViewOverlaySummary(predicateSavedViewArtifact, {
  document: predicateSavedViewArtifact.document,
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    scope: {
      params: [
        { id: "dateRange", label: "Date Range" },
        { id: "channelIds", label: "Channels" },
      ],
    },
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true },
          measures: { reach: true },
        },
      },
    ],
  },
});
// scopeParams.* bindings are supported targets and pinned predicate ids are
// valid overlay filter ids, so no diagnostics surface.
assert.equal(predicateOverlaySummary.diagnostics, undefined);

assert.deepEqual(applySavedViewOverlayToBuilderState(predicateSavedViewArtifact, {
  document: predicateSavedViewArtifact.document,
  state: {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["reach"],
    primaryMeasure: "reach",
    scopeParams: {},
  },
}), {
  selectedDimensions: ["eventDate"],
  selectedMeasures: ["reach"],
  primaryMeasure: "reach",
  scopeParams: {
    dateRange: { start: "2026-06-01", end: "2026-06-07" },
    channelIds: [2, 9],
  },
});

// unknown filter ids still surface diagnostics against the predicate-derived id set
const unknownPredicateFilterSummary = buildSavedViewOverlaySummary({
  ...predicateSavedViewArtifact,
  savedViewOverlay: {
    ...predicateSavedViewArtifact.savedViewOverlay,
    overlay: {
      filters: {
        unknownFilter: true,
      },
    },
  },
}, {
  document: predicateSavedViewArtifact.document,
});
assert.deepEqual(
  unknownPredicateFilterSummary.diagnostics.map((entry) => entry.code),
  ["savedViewOverlayUnknownFilter"],
);

const sparseSavedViewArtifact = {
  ...savedViewArtifact,
  document: {
    ...savedViewArtifact.document,
    presentation: {
      orderFields: savedViewArtifact.document.blocks[0].config.result.orderFields,
      defaultTablePresets: savedViewArtifact.document.blocks[0].config.result.defaultTablePresets,
    },
    datasets: [
      {
        id: "primary",
        dataSourceRef: "demoReportSource",
        label: "Primary",
        kindLabel: "primary",
        columnOptions: [
          { key: "eventDate", label: "Event Date", kind: "dimension" },
          { key: "channelV2", label: "Channel", kind: "dimension" },
          { key: "avails", label: "Avails", kind: "measure" },
        ],
        valueFieldOptions: [
          { value: "avails", label: "Avails" },
        ],
        secondaryFieldOptions: [
          { value: "eventDate", label: "Event Date" },
          { value: "channelV2", label: "Channel" },
        ],
        scopeParamOptions: [
          { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
          { value: "channelsFilter", label: "Channels", kind: "multiSelect" },
        ],
      },
    ],
    blocks: [
      {
        ...savedViewArtifact.document.blocks[0],
        config: {
          title: "Capacity Q3",
        },
      },
    ],
  },
};
assert.equal(applySavedViewOverlayToBuilderState(sparseSavedViewArtifact, {
  document: sparseSavedViewArtifact.document,
  reportSpec: {
    version: 1,
    kind: "reportSpec",
    datasets: [
      {
        id: "primary",
        request: {
          dimensions: { eventDate: true, channelV2: true },
          measures: { avails: true },
        },
      },
    ],
  },
  state: {
    selectedDimensions: ["eventDate", "channelV2"],
    selectedMeasures: ["avails"],
    primaryMeasure: "avails",
    scopeParams: {},
    orderField: "eventDate",
    orderDir: "asc",
    pageSize: 50,
    page: 1,
    viewMode: "chart",
    groupBy: "",
    chartSpec: null,
    activeTablePreset: null,
    lastTablePreset: null,
  },
}).activeTablePreset?.title, "Inventory Ladder");

console.log("savedViewOverlayModel ✓ normalizes saved-view overlays and surfaces compatibility diagnostics");
