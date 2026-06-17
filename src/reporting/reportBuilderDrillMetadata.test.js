import assert from "node:assert/strict";

import { createReportBuilderDrillMetadataProvider, normalizeReportBuilderDrillMetadata } from "./reportBuilderDrillMetadata.js";

const config = {
  drillMetadata: {
    hierarchies: [
      {
        id: "inventory",
        levels: [
          { field: "channelV2", label: "Channel" },
          { field: "publisher", label: "Publisher" },
          { field: "siteType", label: "Site Type" },
        ],
      },
      {
        id: "location",
        levels: [
          { field: "region", label: "Region" },
          { field: "country", label: "Market" },
          { field: "metrocode", label: "Metro Area" },
        ],
      },
    ],
    fieldActions: [
      {
        fieldRef: "eventDate",
        actions: [
          { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://demo/date-detail" },
        ],
      },
      {
        fieldRef: "channelV2",
        actions: [
          { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
          { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://demo/channel-detail" },
        ],
      },
    ],
    detailTargets: [
      {
        targetRef: "target://demo/date-detail",
        navigationMode: "hostRoute",
        parameters: {
          eventDate: "$value",
        },
      },
      {
        targetRef: "target://demo/channel-detail",
        navigationMode: "hostRoute",
        parameters: {
          channel: "$value",
        },
      },
    ],
  },
};

assert.deepEqual(normalizeReportBuilderDrillMetadata(config), {
  hierarchies: [
    {
      id: "inventory",
      levels: [
        { id: "channelV2", field: "channelV2", label: "Channel" },
        { id: "publisher", field: "publisher", label: "Publisher" },
        { id: "siteType", field: "siteType", label: "Site Type" },
      ],
    },
    {
      id: "location",
      levels: [
        { id: "region", field: "region", label: "Region" },
        { id: "country", field: "country", label: "Market" },
        { id: "metrocode", field: "metrocode", label: "Metro Area" },
      ],
    },
  ],
  detailTargets: [
    {
      targetRef: "target://demo/date-detail",
      navigationMode: "hostRoute",
      parameters: {
        eventDate: "$value",
      },
    },
    {
      targetRef: "target://demo/channel-detail",
      navigationMode: "hostRoute",
      parameters: {
        channel: "$value",
      },
    },
  ],
  fieldActions: [
    {
      fieldRef: "eventDate",
      actions: [
        { id: "detail_date", label: "Show date details", kind: "detail", targetRef: "target://demo/date-detail" },
      ],
    },
    {
      fieldRef: "channelV2",
      actions: [
        { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
        { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://demo/channel-detail" },
      ],
    },
  ],
});

const provider = createReportBuilderDrillMetadataProvider(config);

assert.deepEqual(await provider.getDrillHierarchy("channelV2"), {
  drillHierarchy: {
    fieldRef: "channelV2",
    levels: [
      { id: "channelV2", field: "channelV2", label: "Channel" },
      { id: "publisher", field: "publisher", label: "Publisher" },
      { id: "siteType", field: "siteType", label: "Site Type" },
    ],
  },
});
assert.deepEqual(await provider.getDetailTarget("target://demo/date-detail"), {
  detailTarget: {
    targetRef: "target://demo/date-detail",
    navigationMode: "hostRoute",
    parameters: {
      eventDate: "$value",
    },
  },
});
assert.deepEqual(await provider.listAvailableRefinements("chartBlock", "channelV2"), {
  actions: [
    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
    { id: "drill:channelV2:publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisher" },
    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://demo/channel-detail" },
  ],
});
assert.deepEqual(await provider.listAvailableRefinements("tableBlock", "country"), {
  actions: [
    { id: "keep:country", label: "Keep only", kind: "keep" },
    { id: "exclude:country", label: "Exclude", kind: "exclude" },
    { id: "drill:country:metrocode", label: "Drill to Metro Area", kind: "drill", nextFieldRef: "metrocode" },
  ],
});
assert.equal(await provider.getDrillHierarchy("missing"), null);

console.log("reportBuilderDrillMetadata ✓ builds config-backed drill provider contracts from report builder metadata");
