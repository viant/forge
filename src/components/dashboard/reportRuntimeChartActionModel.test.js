import assert from "node:assert/strict";

import {
  buildReportRuntimeChartActionDescriptors,
  resolveReportRuntimeChartSelectionSummary,
} from "./reportRuntimeChartActionModel.js";

const providerActionsByField = new Map([
  ["primaryChart:eventDate", [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ]],
  ["primaryChart:channelV2", [
    { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisher" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
  ]],
]);

assert.equal(resolveReportRuntimeChartSelectionSummary({
  blockTitle: "Avails by Date",
  selection: {
    source: "cartesian",
    xValue: "2026-05-01",
    seriesKey: "Display",
  },
}), "2026-05-01 • Display");

assert.equal(resolveReportRuntimeChartSelectionSummary({
  blockTitle: "Avails by Channel",
  selection: {
    source: "pie",
    xValue: "Display",
    seriesKey: "Display",
  },
}), "Display");

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "primaryChart",
  fields: [
    { valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", selectionSource: "xValue", runtimeFilterable: true },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: true },
  ],
  selection: {
    xValue: "2026-05-01",
    seriesKey: "Display",
    selectionRows: [
      { channelV2: 1, channel: { channel: "Display" } },
      { channelV2: 1, channel: { channel: "Display" } },
    ],
  },
  providerActionsByField,
}), [
  {
    id: "keep:primaryChart:eventDate",
    kind: "keep",
    fieldValueKey: "eventDate",
    label: "Keep only",
    value: "2026-05-01",
    displayValue: "2026-05-01",
  },
  {
    id: "detail_date",
    kind: "detail",
    fieldValueKey: "eventDate",
    label: "Show date details",
    value: "2026-05-01",
    displayValue: "2026-05-01",
    targetRef: "target://steward/performance/date-detail",
  },
  {
    id: "drill_publisher",
    kind: "drill",
    fieldValueKey: "channelV2",
    label: "Drill to Publisher",
    value: 1,
    displayValue: "Display",
    nextFieldRef: "publisher",
  },
  {
    id: "drill_market",
    kind: "drill",
    fieldValueKey: "channelV2",
    label: "Drill to Market",
    value: 1,
    displayValue: "Display",
    nextFieldRef: "country",
  },
  {
    id: "detail_channel",
    kind: "detail",
    fieldValueKey: "channelV2",
    label: "Show channel details",
    value: 1,
    displayValue: "Display",
    targetRef: "target://steward/performance/channel-detail",
  },
]);

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "primaryChart",
  fields: [
    { valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", selectionSource: "xValue", runtimeFilterable: false },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: false },
  ],
  selection: {
    xValue: "2026-05-01",
    seriesKey: "Display",
    selectionRows: [
      { channelV2: 1, channel: { channel: "Display" } },
    ],
  },
  providerActionsByField,
}), [
  {
    id: "detail_date",
    kind: "detail",
    fieldValueKey: "eventDate",
    label: "Show date details",
    value: "2026-05-01",
    displayValue: "2026-05-01",
    targetRef: "target://steward/performance/date-detail",
  },
  {
    id: "detail_channel",
    kind: "detail",
    fieldValueKey: "channelV2",
    label: "Show channel details",
    value: 1,
    displayValue: "Display",
    targetRef: "target://steward/performance/channel-detail",
  },
]);

assert.deepEqual(buildReportRuntimeChartActionDescriptors({
  blockId: "reachRateTrend",
  fields: [
    { valueKey: "country", displayValueKey: "country", label: "Market", selectionSource: "xValue", runtimeFilterable: true },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: false },
  ],
  selection: {
    xValue: "US",
    seriesKey: "Display",
    selectionRows: [
      { channelV2: "Display", channel: { channel: "Display" } },
      { channelV2: "Display", channel: { channel: "Display" } },
    ],
  },
  providerActionsByField: new Map([
    ["reachRateTrend:country", [
      { id: "keep_country", label: "Keep only", kind: "keep" },
      { id: "drill_region", label: "Drill to Region", kind: "drill", nextFieldRef: "region" },
    ]],
    ["reachRateTrend:channelV2", [
      { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
      { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
    ]],
  ]),
}), [
  {
    id: "keep:reachRateTrend:country",
    kind: "keep",
    fieldValueKey: "country",
    label: "Keep only",
    value: "US",
    displayValue: "US",
  },
  {
    id: "drill_region",
    kind: "drill",
    fieldValueKey: "country",
    label: "Drill to Region",
    value: "US",
    displayValue: "US",
    nextFieldRef: "region",
  },
  {
    id: "detail_channel",
    kind: "detail",
    fieldValueKey: "channelV2",
    label: "Show channel details",
    value: "Display",
    displayValue: "Display",
    targetRef: "target://steward/performance/channel-detail",
  },
]);

console.log("reportRuntimeChartActionModel ✓ builds deterministic chart action descriptors for runtime selections");
