import assert from "node:assert/strict";

import { applyPreviewRequestFilters, runPreviewRuntimeRequest } from "./previewRuntimeQuery.js";

const rows = [
  { eventDate: "2026-05-01", channelV2: "Display", country: "US", avails: 10, hhUniqs: 3, channelsFilter: "Display" },
  { eventDate: "2026-05-01", channelV2: "Display", country: "CA", avails: 8, hhUniqs: 2, channelsFilter: "Display" },
  { eventDate: "2026-05-01", channelV2: "CTV", country: "US", avails: 12, hhUniqs: 4, channelsFilter: "CTV" },
  { eventDate: "2026-05-01", channelV2: "Display", country: "US", region: "CA", avails: 7, hhUniqs: 2, channelsFilter: "Display" },
];

const config = {
  dimensions: [
    {
      id: "channelV2",
      key: "channelV2",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
    {
      id: "country",
      key: "country",
      runtimeFilter: {
        includeParamPath: "filters.includeCountry",
        excludeParamPath: "filters.excludeCountry",
      },
    },
    {
      id: "region",
      key: "region",
      runtimeFilter: {
        includeParamPath: "filters.includeLocationDim",
        excludeParamPath: "filters.excludeLocationDim",
        format: "locationTuple",
        parentField: "country",
      },
    },
  ],
};

assert.deepEqual(
  applyPreviewRequestFilters(rows, {
    filters: {
      from: "2026-05-01",
      to: "2026-05-01",
      channelsFilter: ["Display"],
    },
  }),
  [
    { eventDate: "2026-05-01", channelV2: "Display", country: "US", avails: 10, hhUniqs: 3, channelsFilter: "Display" },
    { eventDate: "2026-05-01", channelV2: "Display", country: "CA", avails: 8, hhUniqs: 2, channelsFilter: "Display" },
    { eventDate: "2026-05-01", channelV2: "Display", country: "US", region: "CA", avails: 7, hhUniqs: 2, channelsFilter: "Display" },
  ],
);

assert.deepEqual(
  runPreviewRuntimeRequest(rows, {
    dimensions: {
      eventDate: true,
      country: true,
    },
    measures: {
      avails: true,
    },
    refinements: [
      {
        op: "drill",
        field: "channelV2",
        values: ["Display"],
      },
    ],
    orderBy: ["country asc"],
    limit: 10,
  }),
  {
    rows: [
      { eventDate: "2026-05-01", country: "CA", avails: 8 },
      { eventDate: "2026-05-01", country: "US", avails: 17 },
    ],
    hasMore: false,
  },
);

assert.deepEqual(
  applyPreviewRequestFilters(rows, {
    filters: {
      includeCountry: ["US"],
      includeChannelV2: ["Display"],
      includeLocationDim: ["US/CA"],
    },
  }, config),
  [
    { eventDate: "2026-05-01", channelV2: "Display", country: "US", region: "CA", avails: 7, hhUniqs: 2, channelsFilter: "Display" },
  ],
);

console.log("previewRuntimeQuery ✓ runs the shared preview request pipeline from raw dataset rows");
