import assert from "node:assert/strict";

import { buildReportRuntimeChartActionDescriptors } from "./reportRuntimeChartActionModel.js";
import {
  buildIdleReportRuntimeProviderActionsState,
  buildPendingReportRuntimeProviderActionsState,
  buildResolvedReportRuntimeProviderActionsState,
  loadReportRuntimeProviderActions,
  resolveReportRuntimeProviderActions,
} from "./reportRuntimeProviderActions.js";
import { buildReportRuntimeTableActionDescriptors } from "./reportRuntimeTableActionModel.js";

const reportSpec = {
  datasets: [
    {
      id: "primary",
      request: {
        dimensions: {
          channelV2: true,
          country: true,
        },
      },
    },
  ],
  blocks: [
    {
      id: "primaryTable",
      kind: "tableBlock",
      datasetRef: "primary",
      columns: [
        {
          key: "channelV2",
          sourceKey: "channelV2",
          displayKey: "channel.channel",
          label: "Channel",
          runtimeFilterable: true,
        },
        {
          key: "country",
          sourceKey: "country",
          displayKey: "country",
          label: "Market",
          runtimeFilterable: true,
        },
      ],
    },
  ],
};

const blocks = [
  reportSpec.blocks[0],
  {
    id: "primaryChart",
    kind: "chartBlock",
    datasetRef: "primary",
    chartSpec: {
      xField: "country",
      seriesField: "channelV2",
    },
  },
  {
    id: "narrativeIntro",
    kind: "markdownBlock",
  },
];

assert.deepEqual(buildIdleReportRuntimeProviderActionsState(), {
  providerActionsByField: new Map(),
  providerDiagnostics: [],
  loading: false,
});

assert.deepEqual(buildPendingReportRuntimeProviderActionsState({
  providerActionsByField: new Map([
    ["primaryTable:channelV2", [{ id: "keep_channel", label: "Keep only", kind: "keep" }]],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Old warning",
    },
  ],
}), {
  providerActionsByField: new Map([
    ["primaryTable:channelV2", [{ id: "keep_channel", label: "Keep only", kind: "keep" }]],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Old warning",
    },
  ],
  loading: true,
});

assert.deepEqual(buildResolvedReportRuntimeProviderActionsState({
  providerActionsByField: new Map([
    ["primaryTable:channelV2", [{ id: "keep_channel", label: "Keep only", kind: "keep" }]],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Fresh warning",
    },
  ],
}), {
  providerActionsByField: new Map([
    ["primaryTable:channelV2", [{ id: "keep_channel", label: "Keep only", kind: "keep" }]],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Fresh warning",
    },
  ],
  loading: false,
});

const failedRetryState = buildResolvedReportRuntimeProviderActionsState({
  providerActionsByField: new Map([
    ["primaryChart:channelV2", []],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Retry me",
    },
  ],
});
assert.deepEqual(failedRetryState, {
  providerActionsByField: new Map([
    ["primaryChart:channelV2", []],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Retry me",
    },
  ],
  loading: false,
});
const pendingRetryState = buildPendingReportRuntimeProviderActionsState(failedRetryState);
assert.deepEqual(pendingRetryState, {
  providerActionsByField: new Map([
    ["primaryChart:channelV2", []],
  ]),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Retry me",
    },
  ],
  loading: true,
});
assert.deepEqual(buildResolvedReportRuntimeProviderActionsState({
  providerActionsByField: new Map([
    ["primaryChart:channelV2", [{ id: "detail_channel", label: "Show channel details", kind: "detail" }]],
  ]),
  providerDiagnostics: [],
}), {
  providerActionsByField: new Map([
    ["primaryChart:channelV2", [{ id: "detail_channel", label: "Show channel details", kind: "detail" }]],
  ]),
  providerDiagnostics: [],
  loading: false,
});

assert.deepEqual(await resolveReportRuntimeProviderActions({
  provider: null,
  reportSpec,
  blocks,
}), {
  providerActionsByField: new Map(),
  providerDiagnostics: [],
});

const successfulProvider = {
  async listAvailableRefinements(blockKind = "", fieldRef = "") {
    return [
      {
        id: `${blockKind}:${fieldRef}:keep`,
        label: "Keep only",
        kind: "keep",
      },
    ];
  },
};

const successfulResult = await resolveReportRuntimeProviderActions({
  provider: successfulProvider,
  reportSpec,
  blocks,
});
assert.deepEqual(await loadReportRuntimeProviderActions({
  provider: successfulProvider,
  reportSpec,
  blocks,
}), successfulResult);

assert.deepEqual(Array.from(successfulResult.providerActionsByField.entries()), [
  [
    "primaryTable:channelV2",
    [
      {
        id: "tableBlock:channelV2:keep",
        label: "Keep only",
        kind: "keep",
      },
    ],
  ],
  [
    "primaryTable:country",
    [
      {
        id: "tableBlock:country:keep",
        label: "Keep only",
        kind: "keep",
      },
    ],
  ],
  [
    "primaryChart:country",
    [
      {
        id: "chartBlock:country:keep",
        label: "Keep only",
        kind: "keep",
      },
    ],
  ],
  [
    "primaryChart:channelV2",
    [
      {
        id: "chartBlock:channelV2:keep",
        label: "Keep only",
        kind: "keep",
      },
    ],
  ],
]);
assert.deepEqual(successfulResult.providerDiagnostics, []);

assert.deepEqual(buildReportRuntimeTableActionDescriptors({
  blockId: "primaryTable",
  field: {
    valueKey: "channelV2",
    label: "Channel",
    runtimeFilterable: true,
  },
  providerActionsByField: successfulResult.providerActionsByField,
}), [
  {
    id: "keep:channelV2",
    kind: "keep",
    fieldValueKey: "channelV2",
    label: "Keep only",
  },
]);

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "primaryChart",
  fields: [
    {
      valueKey: "country",
      displayValueKey: "country",
      label: "Market",
      selectionSource: "xValue",
      runtimeFilterable: true,
    },
  ],
  selection: {
    xValue: "US",
    selectionRows: [
      { country: "US" },
    ],
  },
  providerActionsByField: successfulResult.providerActionsByField,
}), [
  {
    id: "keep:primaryChart:country",
    kind: "keep",
    fieldValueKey: "country",
    label: "Keep only",
    value: "US",
    displayValue: "US",
  },
]);

const failingProvider = {
  async listAvailableRefinements(blockKind = "", fieldRef = "") {
    if (blockKind === "chartBlock" && fieldRef === "country") {
      throw new Error("Provider offline");
    }
    return [];
  },
};

const failingResult = await resolveReportRuntimeProviderActions({
  provider: failingProvider,
  reportSpec,
  blocks,
});

assert.deepEqual(Array.from(failingResult.providerActionsByField.entries()), [
  ["primaryTable:channelV2", []],
  ["primaryTable:country", []],
  ["primaryChart:country", []],
  ["primaryChart:channelV2", []],
]);
assert.deepEqual(failingResult.providerDiagnostics, [
  {
    code: "actionProviderFailed",
    blockId: "primaryChart",
    path: "reportRuntime.blocks.primaryChart.actions.country",
    severity: "warning",
    message: "Failed to load refinement actions for Market. Provider offline",
    suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
  },
]);

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "primaryChart",
  fields: [
    {
      valueKey: "country",
      displayValueKey: "country",
      label: "Market",
      selectionSource: "xValue",
      runtimeFilterable: true,
    },
  ],
  selection: {
    xValue: "US",
    selectionRows: [
      { country: "US" },
    ],
  },
  providerActionsByField: failingResult.providerActionsByField,
}), []);

assert.deepEqual(buildReportRuntimeTableActionDescriptors({
  blockId: "primaryTable",
  field: {
    valueKey: "country",
    label: "Market",
    runtimeFilterable: true,
  },
  providerActionsByField: failingResult.providerActionsByField,
}), []);

const mixedProvider = {
  async listAvailableRefinements(blockKind = "", fieldRef = "") {
    if (blockKind === "chartBlock" && fieldRef === "country") {
      throw new Error("Chart country lookup unavailable");
    }
    if (blockKind === "chartBlock" && fieldRef === "channelV2") {
      return [
        {
          id: "detail_channel",
          label: "Show channel details",
          kind: "detail",
          targetRef: "target://example/performance/channel-detail",
        },
      ];
    }
    return [];
  },
};

const mixedResult = await resolveReportRuntimeProviderActions({
  provider: mixedProvider,
  reportSpec,
  blocks,
});

assert.deepEqual(mixedResult.providerDiagnostics, [
  {
    code: "actionProviderFailed",
    blockId: "primaryChart",
    path: "reportRuntime.blocks.primaryChart.actions.country",
    severity: "warning",
    message: "Failed to load refinement actions for Market. Chart country lookup unavailable",
    suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
  },
]);

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "primaryChart",
  fields: [
    {
      valueKey: "country",
      displayValueKey: "country",
      label: "Market",
      selectionSource: "xValue",
      runtimeFilterable: true,
    },
    {
      valueKey: "channelV2",
      displayValueKey: "channel.channel",
      label: "Channel",
      selectionSource: "seriesKey",
      runtimeFilterable: false,
    },
  ],
  selection: {
    xValue: "US",
    seriesKey: "Display",
    selectionRows: [
      { country: "US", channelV2: "Display", channel: { channel: "Display" } },
    ],
  },
  providerActionsByField: mixedResult.providerActionsByField,
}), [
  {
    id: "detail_channel",
    kind: "detail",
    fieldValueKey: "channelV2",
    label: "Show channel details",
    value: "Display",
    displayValue: "Display",
    targetRef: "target://example/performance/channel-detail",
  },
]);

const concurrentStarts = [];
const concurrentResolvers = [];
const concurrentProvider = {
  listAvailableRefinements(blockKind = "", fieldRef = "") {
    concurrentStarts.push(`${blockKind}:${fieldRef}`);
    return new Promise((resolve) => {
      concurrentResolvers.push({ blockKind, fieldRef, resolve });
    });
  },
};

const concurrentPromise = resolveReportRuntimeProviderActions({
  provider: concurrentProvider,
  reportSpec,
  blocks,
});

await Promise.resolve();

assert.deepEqual(concurrentStarts.slice().sort(), [
  "tableBlock:channelV2",
  "tableBlock:country",
  "chartBlock:country",
  "chartBlock:channelV2",
].sort());

concurrentResolvers.forEach(({ resolve }) => resolve([]));

const concurrentResult = await concurrentPromise;

assert.deepEqual(Array.from(concurrentResult.providerActionsByField.entries()), [
  ["primaryTable:channelV2", []],
  ["primaryTable:country", []],
  ["primaryChart:country", []],
  ["primaryChart:channelV2", []],
]);
assert.deepEqual(concurrentResult.providerDiagnostics, []);

const syncThrowingProvider = {
  listAvailableRefinements(blockKind = "", fieldRef = "") {
    if (blockKind === "chartBlock" && fieldRef === "country") {
      throw new Error("Sync provider offline");
    }
    return [];
  },
};

const syncThrowResult = await resolveReportRuntimeProviderActions({
  provider: syncThrowingProvider,
  reportSpec,
  blocks,
});

assert.deepEqual(Array.from(syncThrowResult.providerActionsByField.entries()), [
  ["primaryTable:channelV2", []],
  ["primaryTable:country", []],
  ["primaryChart:country", []],
  ["primaryChart:channelV2", []],
]);
assert.deepEqual(syncThrowResult.providerDiagnostics, [
  {
    code: "actionProviderFailed",
    blockId: "primaryChart",
    path: "reportRuntime.blocks.primaryChart.actions.country",
    severity: "warning",
    message: "Failed to load refinement actions for Market. Sync provider offline",
    suggestedFix: "Retry the action provider or continue without runtime refinements for this block.",
  },
]);

const loaderCatchResult = await loadReportRuntimeProviderActions({
  provider: successfulProvider,
  reportSpec,
  blocks,
  resolver: async () => {
    throw new Error("Synthetic loader failure");
  },
});

assert.deepEqual(loaderCatchResult, {
  providerActionsByField: new Map(),
  providerDiagnostics: [
    {
      code: "actionProviderFailed",
      severity: "warning",
      message: "Failed to load refinement actions. Synthetic loader failure",
      suggestedFix: "Retry the action provider or continue without runtime refinements for this runtime surface.",
    },
  ],
});

console.log("reportRuntimeProviderActions ✓ resolves runtime provider actions and diagnostics deterministically");
