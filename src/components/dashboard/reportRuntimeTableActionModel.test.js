import assert from "node:assert/strict";

import { buildReportRuntimeTableActionDescriptors } from "./reportRuntimeTableActionModel.js";

const providerActionsByField = new Map([
  ["comparisonTable:channelV2", [
    { id: "keep_channel", label: "Keep only", kind: "keep" },
    { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisher" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
  ]],
]);

assert.deepEqual(buildReportRuntimeTableActionDescriptors({
  blockId: "comparisonTable",
  field: {
    valueKey: "channelV2",
    label: "Channel",
    runtimeFilterable: true,
  },
  providerActionsByField,
}), [
  {
    id: "keep:channelV2",
    kind: "keep",
    fieldValueKey: "channelV2",
    label: "Keep only",
  },
  {
    id: "drill_publisher",
    kind: "drill",
    fieldValueKey: "channelV2",
    label: "Drill to Publisher",
    nextFieldRef: "publisher",
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
    targetRef: "target://steward/performance/channel-detail",
  },
]);

assert.deepEqual(buildReportRuntimeTableActionDescriptors({
  blockId: "comparisonTable",
  field: {
    valueKey: "channelV2",
    label: "Channel",
    runtimeFilterable: false,
  },
  providerActionsByField,
}), [
  {
    id: "detail_channel",
    kind: "detail",
    fieldValueKey: "channelV2",
    label: "Show channel details",
    targetRef: "target://steward/performance/channel-detail",
  },
]);

assert.deepEqual(buildReportRuntimeTableActionDescriptors({
  blockId: "reachRateTable",
  field: {
    valueKey: "channelV2",
    displayValueKey: "channel.channel",
    label: "Channel",
    runtimeFilterable: true,
  },
  providerActionsByField: new Map([
    ["reachRateTable:channelV2", [
      { label: "Keep only", kind: "keep" },
      { label: "Exclude", kind: "exclude" },
      { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
    ]],
  ]),
}), [
  {
    id: "keep:channelV2",
    kind: "keep",
    fieldValueKey: "channelV2",
    label: "Keep only",
  },
  {
    id: "exclude:channelV2",
    kind: "exclude",
    fieldValueKey: "channelV2",
    label: "Exclude",
  },
  {
    id: "drill_publisher",
    kind: "drill",
    fieldValueKey: "channelV2",
    label: "Drill to Publisher",
    nextFieldRef: "publisherId",
  },
]);

console.log("reportRuntimeTableActionModel ✓ builds deterministic table action descriptors from provider metadata");
