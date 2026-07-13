import assert from "node:assert/strict";

import { buildReportRuntimeTableActionExecutions } from "./reportRuntimeTableExecutionModel.js";

const executions = buildReportRuntimeTableActionExecutions({
  blockId: "comparisonTable",
  descriptors: [
    {
      id: "keep:channelV2",
      kind: "keep",
      fieldValueKey: "channelV2",
      label: "Keep only",
    },
    {
      id: "drill_market",
      kind: "drill",
      fieldValueKey: "channelV2",
      label: "Drill to Market",
      nextFieldRef: "country",
    },
    {
      id: "detail_channel",
      kind: "detail",
      fieldValueKey: "channelV2",
      label: "Show channel details",
      targetRef: "target://example/performance/channel-detail",
    },
  ],
  field: {
    valueKey: "channelV2",
    displayValueKey: "channel.channel",
    label: "Channel",
    selectionSource: "seriesKey",
  },
  item: {
    channelV2: 1,
    channel: { channel: "Display" },
    campaign: "Prospect Sprint",
  },
});

assert.deepEqual(executions, [
  {
    id: "keep:channelV2",
    label: "Keep only",
    kind: "keep",
    refinement: {
      op: "keep",
      field: "channelV2",
      value: 1,
      sourceBlockId: "comparisonTable",
      fieldLabel: "Channel",
      label: "Keep only = Display",
    },
  },
  {
    id: "drill_market",
    label: "Drill to Market",
    kind: "drill",
    transition: {
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "comparisonTable",
    },
    refinement: {
      op: "drill",
      field: "channelV2",
      value: 1,
      sourceBlockId: "comparisonTable",
      fieldLabel: "Channel",
      label: "Drill to Market: Channel = Display",
    },
  },
  {
    id: "detail_channel",
    label: "Show channel details",
    kind: "detail",
    detailRequest: {
      action: {
        id: "detail_channel",
        kind: "detail",
        label: "Show channel details",
        targetRef: "target://example/performance/channel-detail",
      },
      item: {
        channelV2: 1,
        channel: { channel: "Display" },
        campaign: "Prospect Sprint",
      },
      value: 1,
      field: {
        valueKey: "channelV2",
        displayValueKey: "channel.channel",
        label: "Channel",
        selectionSource: "seriesKey",
      },
      sourceBlockId: "comparisonTable",
    },
  },
]);

assert.deepEqual(buildReportRuntimeTableActionExecutions({
  blockId: "comparisonTable",
  descriptors: [
    {
      id: "keep:channelId",
      kind: "keep",
      fieldValueKey: "channelId",
      label: "Keep only",
    },
  ],
  field: {
    valueKey: "channelId",
    displayValueKey: "channelName",
    displayValueMap: {
      "1": "Display",
      "2": "CTV",
    },
    label: "Channel",
  },
  item: {
    channelId: 1,
  },
}), [
  {
    id: "keep:channelId",
    label: "Keep only",
    kind: "keep",
    refinement: {
      op: "keep",
      field: "channelId",
      value: 1,
      sourceBlockId: "comparisonTable",
      fieldLabel: "Channel",
      label: "Keep only = Display",
    },
  },
]);

assert.deepEqual(buildReportRuntimeTableActionExecutions({
  blockId: "comparisonTable",
  descriptors: [
    {
      id: "drill_channel",
      kind: "drill",
      fieldValueKey: "channelId",
      label: "Drill Channel",
      nextFieldRef: "publisherId",
    },
  ],
  field: {
    valueKey: "channelId",
    displayValueKey: "channelName",
    displayValueMap: {
      "1": "Display",
    },
    label: "Channel",
  },
  item: {
    channelId: 1,
  },
}), [
  {
    id: "drill_channel",
    label: "Drill Channel",
    kind: "drill",
    transition: {
      sourceField: "channelId",
      nextFieldRef: "publisherId",
      sourceBlockId: "comparisonTable",
    },
    refinement: {
      op: "drill",
      field: "channelId",
      value: 1,
      sourceBlockId: "comparisonTable",
      fieldLabel: "Channel",
      label: "Drill Channel: Channel = Display",
    },
  },
]);

assert.deepEqual(buildReportRuntimeTableActionExecutions({
  blockId: "comparisonTable",
  descriptors: [
    {
      id: "keep:channelId",
      kind: "keep",
      fieldValueKey: "channelId",
      label: "Keep only",
    },
  ],
  field: {
    valueKey: "channelId",
    displayValueKey: "channelId",
    displayValueMap: {
      "1": "Display",
      "2": "CTV",
    },
    label: "Channel",
  },
  item: {
    channelId: 1,
  },
}), [
  {
    id: "keep:channelId",
    label: "Keep only",
    kind: "keep",
    refinement: {
      op: "keep",
      field: "channelId",
      value: 1,
      sourceBlockId: "comparisonTable",
      fieldLabel: "Channel",
      label: "Keep only = Display",
    },
  },
]);

console.log("reportRuntimeTableExecutionModel ✓ derives deterministic table action payloads from runtime rows");
