import assert from "node:assert/strict";

import { buildReportRuntimeChartInteractionState } from "./reportRuntimeChartInteractionState.js";

const providerActionsByField = new Map([
  ["primaryChart:eventDate", [
    { id: "keep_date", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://steward/performance/date-detail" },
  ]],
  ["primaryChart:channelV2", [
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
  ]],
]);

const multiSeries = buildReportRuntimeChartInteractionState({
  blockId: "primaryChart",
  blockTitle: "Avails by Date and Channel",
  fields: [
    { valueKey: "eventDate", label: "Date", selectionSource: "xValue", runtimeFilterable: true },
    { valueKey: "channelV2", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: true },
  ],
  selection: {
    source: "cartesian",
    xValue: "2026-05-01",
    seriesKey: "Display",
    row: {
      eventDate: "2026-05-01",
      Display: 40400,
      CTV: 34300,
    },
    selectionRows: [
      { campaign: "Prospect Sprint", scopeFilter: "national" },
      { campaign: "Family Reach", scopeFilter: "national" },
    ],
  },
  providerActionsByField,
  interactionSupport: {
    enabled: true,
    legendEnabled: true,
  },
  canClearSelection: true,
});

assert.equal(multiSeries.descriptors.length, 4);
assert.equal(multiSeries.executions.length, 4);
assert.deepEqual(multiSeries.viewModel, {
  kind: "selected",
  summary: "2026-05-01 • Display",
  actions: [
    { id: "keep:primaryChart:eventDate", label: "Keep only", kind: "keep" },
    { id: "detail_date", label: "Show date details", kind: "detail" },
    { id: "drill_market", label: "Drill to Market", kind: "drill" },
    { id: "detail_channel", label: "Show channel details", kind: "detail" },
  ],
  canClearSelection: true,
});
assert.equal(multiSeries.executions[3].detailRequest.item.selectionRows.length, 2);

const idle = buildReportRuntimeChartInteractionState({
  blockId: "primaryChart",
  blockTitle: "Avails by Channel",
  fields: [
    { valueKey: "channelV2", label: "Channel", selectionSource: "xValue", runtimeFilterable: true },
  ],
  selection: null,
  providerActionsByField,
  interactionSupport: {
    enabled: true,
    legendEnabled: false,
  },
  canClearSelection: false,
});

assert.deepEqual(idle.viewModel, {
  kind: "idle",
  message: "Click a chart mark to apply authored runtime actions.",
});

const authoredDerived = buildReportRuntimeChartInteractionState({
  blockId: "reachRateTrend",
  blockTitle: "Reach Rate by Market",
  fields: [
    { valueKey: "country", label: "Market", selectionSource: "xValue", runtimeFilterable: true },
    { valueKey: "channelV2", label: "Channel", selectionSource: "seriesKey", runtimeFilterable: false },
  ],
  selection: {
    source: "cartesian",
    xValue: "US",
    seriesKey: "Display",
    row: {
      country: "US",
      reachRate: 40.82,
    },
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
      { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://steward/performance/channel-detail" },
    ]],
  ]),
  interactionSupport: {
    enabled: true,
    legendEnabled: true,
  },
  canClearSelection: true,
});

assert.deepEqual(authoredDerived.viewModel, {
  kind: "selected",
  summary: "US • Display",
  actions: [
    { id: "keep:reachRateTrend:country", label: "Keep only", kind: "keep" },
    { id: "drill_region", label: "Drill to Region", kind: "drill" },
    { id: "detail_channel", label: "Show channel details", kind: "detail" },
  ],
  canClearSelection: true,
});
assert.deepEqual(authoredDerived.executions.map((entry) => ({
  id: entry.id,
  kind: entry.kind,
  label: entry.label,
})), [
  { id: "keep:reachRateTrend:country", kind: "keep", label: "Keep only" },
  { id: "drill_region", kind: "drill", label: "Drill to Region" },
  { id: "detail_channel", kind: "detail", label: "Show channel details" },
]);

console.log("reportRuntimeChartInteractionState ✓ composes chart selection, actions, and executions for supported runtime flows");
