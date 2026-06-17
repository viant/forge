import assert from "node:assert/strict";

import { buildReportRuntimeChartActionExecutions } from "./reportRuntimeChartExecutionModel.js";

const executions = buildReportRuntimeChartActionExecutions({
  blockId: "primaryChart",
  descriptors: [
    {
      id: "keep:primaryChart:eventDate",
      kind: "keep",
      fieldValueKey: "eventDate",
      label: "Keep only",
      value: "2026-05-01",
      displayValue: "2026-05-01",
    },
    {
      id: "drill_market",
      kind: "drill",
      fieldValueKey: "channelV2",
      label: "Drill to Market",
      value: "Display",
      displayValue: "Display",
      nextFieldRef: "country",
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
  ],
  fields: [
    { valueKey: "eventDate", displayValueKey: "eventDate", label: "Date", selectionSource: "xValue" },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey" },
  ],
  selection: {
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
});

assert.deepEqual(executions, [
  {
    id: "keep:primaryChart:eventDate",
    label: "Keep only",
    kind: "keep",
    refinement: {
      op: "keep",
      field: "eventDate",
      value: "2026-05-01",
      sourceBlockId: "primaryChart",
      fieldLabel: "Date",
      label: "Keep only = 2026-05-01",
    },
  },
  {
    id: "drill_market",
    label: "Drill to Market",
    kind: "drill",
    transition: {
      sourceField: "channelV2",
      nextFieldRef: "country",
      sourceBlockId: "primaryChart",
    },
    refinement: {
      op: "drill",
      field: "channelV2",
      value: "Display",
      sourceBlockId: "primaryChart",
      fieldLabel: "Channel",
      label: "Drill to Market = Display",
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
        targetRef: "target://steward/performance/channel-detail",
      },
      item: {
        eventDate: "2026-05-01",
        Display: 40400,
        CTV: 34300,
        selectionRows: [
          { campaign: "Prospect Sprint", scopeFilter: "national" },
          { campaign: "Family Reach", scopeFilter: "national" },
        ],
      },
      value: "Display",
      field: {
        valueKey: "channelV2",
        displayValueKey: "channel.channel",
        label: "Channel",
        selectionSource: "seriesKey",
      },
      sourceBlockId: "primaryChart",
    },
  },
]);

const authoredDerivedExecutions = buildReportRuntimeChartActionExecutions({
  blockId: "reachRateTrend",
  descriptors: [
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
  ],
  fields: [
    { valueKey: "country", displayValueKey: "country", label: "Market", selectionSource: "xValue" },
    { valueKey: "channelV2", displayValueKey: "channel.channel", label: "Channel", selectionSource: "seriesKey" },
  ],
  selection: {
    xValue: "US",
    seriesKey: "Display",
    row: {
      country: "US",
      channelV2: "Display",
      reachRate: 40.82,
    },
    selectionRows: [
      { channelV2: "Display", channel: { channel: "Display" }, region: "West" },
      { channelV2: "Display", channel: { channel: "Display" }, region: "Midwest" },
    ],
  },
});

assert.deepEqual(authoredDerivedExecutions, [
  {
    id: "keep:reachRateTrend:country",
    label: "Keep only",
    kind: "keep",
    refinement: {
      op: "keep",
      field: "country",
      value: "US",
      sourceBlockId: "reachRateTrend",
      fieldLabel: "Market",
      label: "Keep only = US",
    },
  },
  {
    id: "drill_region",
    label: "Drill to Region",
    kind: "drill",
    transition: {
      sourceField: "country",
      nextFieldRef: "region",
      sourceBlockId: "reachRateTrend",
    },
    refinement: {
      op: "drill",
      field: "country",
      value: "US",
      sourceBlockId: "reachRateTrend",
      fieldLabel: "Market",
      label: "Drill to Region = US",
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
        targetRef: "target://steward/performance/channel-detail",
      },
      item: {
        country: "US",
        channelV2: "Display",
        reachRate: 40.82,
        selectionRows: [
          { channelV2: "Display", channel: { channel: "Display" }, region: "West" },
          { channelV2: "Display", channel: { channel: "Display" }, region: "Midwest" },
        ],
      },
      value: "Display",
      field: {
        valueKey: "channelV2",
        displayValueKey: "channel.channel",
        label: "Channel",
        selectionSource: "seriesKey",
      },
      sourceBlockId: "reachRateTrend",
    },
  },
]);

console.log("reportRuntimeChartExecutionModel ✓ derives deterministic runtime action payloads from chart selections");
