import assert from "node:assert/strict";

import {
  buildReportRuntimeTableInteractionState,
  resolveReportRuntimeTableInteractionExecution,
} from "./reportRuntimeTableInteractionState.js";

const providerActionsByField = new Map([
  ["comparisonTable:eventDate", [
    { label: "Keep only", kind: "keep" },
    { label: "Exclude", kind: "exclude" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://example/performance/date-detail" },
  ]],
  ["comparisonTable:channelV2", [
    { label: "Keep only", kind: "keep" },
    { label: "Exclude", kind: "exclude" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
  ]],
]);

const interactionState = buildReportRuntimeTableInteractionState({
  blockId: "comparisonTable",
  fields: [
    { valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", runtimeFilterable: true },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", runtimeFilterable: true },
  ],
  providerActionsByField,
});

assert.equal(interactionState.descriptors.length, 7);
assert.equal(interactionState.actionEntries.length, 7);
assert.deepEqual(interactionState.actions.map((action) => ({
  id: action.id,
  label: action.label,
  kind: action.kind,
  publishSelection: action.publishSelection,
})), [
  {
    id: "keep:eventDate",
    label: "Keep Date",
    kind: "keep",
    publishSelection: false,
  },
  {
    id: "exclude:eventDate",
    label: "Exclude Date",
    kind: "exclude",
    publishSelection: false,
  },
  {
    id: "detail_date",
    label: "Show date details",
    kind: "detail",
    publishSelection: false,
  },
  {
    id: "keep:channelV2",
    label: "Keep Channel",
    kind: "keep",
    publishSelection: false,
  },
  {
    id: "exclude:channelV2",
    label: "Exclude Channel",
    kind: "exclude",
    publishSelection: false,
  },
  {
    id: "drill_market",
    label: "Drill to Market",
    kind: "drill",
    publishSelection: false,
  },
  {
    id: "detail_channel",
    label: "Show channel details",
    kind: "detail",
    publishSelection: false,
  },
]);
assert.equal(typeof interactionState.actions[5].resolveExecution, "function");
assert.deepEqual(interactionState.actions[5].resolveExecution({
  channelV2: 1,
  channel: { channel: "Display" },
  campaign: "Prospect Sprint",
}), {
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
});

assert.deepEqual(resolveReportRuntimeTableInteractionExecution({
  blockId: "comparisonTable",
  actionEntries: interactionState.actionEntries,
  actionId: "drill_market",
  item: {
    channelV2: 1,
    channel: { channel: "Display" },
    campaign: "Prospect Sprint",
  },
}), {
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
});

assert.equal(resolveReportRuntimeTableInteractionExecution({
  blockId: "comparisonTable",
  actionEntries: interactionState.actionEntries,
  actionId: "unknown",
  item: {
    channelV2: "Display",
  },
}), null);

const authoredDerivedInteractionState = buildReportRuntimeTableInteractionState({
  blockId: "reachRateTable",
  fields: [
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", runtimeFilterable: true },
  ],
  providerActionsByField: new Map([
    ["reachRateTable:channelV2", [
      { label: "Keep only", kind: "keep" },
      { label: "Exclude", kind: "exclude" },
      { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
    ]],
  ]),
});

assert.deepEqual(authoredDerivedInteractionState.actions.map((action) => ({
  id: action.id,
  label: action.label,
  kind: action.kind,
  publishSelection: action.publishSelection,
})), [
  {
    id: "keep:channelV2",
    label: "Keep Channel",
    kind: "keep",
    publishSelection: false,
  },
  {
    id: "exclude:channelV2",
    label: "Exclude Channel",
    kind: "exclude",
    publishSelection: false,
  },
  {
    id: "drill_publisher",
    label: "Drill to Publisher",
    kind: "drill",
    publishSelection: false,
  },
]);

assert.deepEqual(authoredDerivedInteractionState.actions[2].resolveExecution({
  channelV2: 1,
  channel: { channel: "Display" },
}), {
  id: "drill_publisher",
  label: "Drill to Publisher",
  kind: "drill",
  transition: {
    sourceField: "channelV2",
    nextFieldRef: "publisherId",
    sourceBlockId: "reachRateTable",
  },
  refinement: {
    op: "drill",
    field: "channelV2",
    value: 1,
    sourceBlockId: "reachRateTable",
    fieldLabel: "Channel",
    label: "Drill to Publisher: Channel = Display",
  },
});

console.log("reportRuntimeTableInteractionState ✓ composes table row actions and resolves runtime executions deterministically");
