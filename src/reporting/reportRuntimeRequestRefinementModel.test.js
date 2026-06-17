import assert from "node:assert/strict";

import {
  applyRuntimeRequestRefinementFilters,
  hasRuntimeRequestRefinementFilter,
} from "./reportRuntimeRequestRefinementModel.js";

const config = {
  dimensions: [
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
    {
      id: "channelV2",
      key: "channelV2",
      runtimeFilter: {
        includeParamPath: "filters.includeChannelV2",
        excludeParamPath: "filters.excludeChannelV2",
      },
    },
  ],
};

assert.deepEqual(
  applyRuntimeRequestRefinementFilters({
    measures: { avails: true },
    dimensions: { eventDate: true, country: true, region: true },
    refinements: [
      { op: "drill", field: "country", values: ["GB"] },
      { op: "drill", field: "region", values: ["GB-HEF"] },
    ],
  }, config),
  {
    measures: { avails: true },
    dimensions: { eventDate: true, country: true, region: true },
    filters: {
      includeCountry: ["GB"],
      includeLocationDim: ["GB/GB-HEF"],
    },
    refinements: [
      { op: "drill", field: "country", values: ["GB"] },
      { op: "drill", field: "region", values: ["GB-HEF"] },
    ],
  },
);

assert.deepEqual(
  applyRuntimeRequestRefinementFilters({
    measures: { avails: true },
    dimensions: { eventDate: true, channelV2: true },
    filters: {
      includeChannelV2: [2],
    },
    refinements: [
      { op: "keep", field: "channelV2", values: [1] },
      { op: "exclude", field: "country", values: ["CA"] },
    ],
  }, config),
  {
    measures: { avails: true },
    dimensions: { eventDate: true, channelV2: true },
    filters: {
      includeChannelV2: [2, 1],
      excludeCountry: ["CA"],
    },
    refinements: [
      { op: "keep", field: "channelV2", values: [1] },
      { op: "exclude", field: "country", values: ["CA"] },
    ],
  },
);

assert.equal(hasRuntimeRequestRefinementFilter(config, "country"), true);
assert.equal(hasRuntimeRequestRefinementFilter(config, "missing"), false);

assert.deepEqual(
  applyRuntimeRequestRefinementFilters({
    dimensions: { country: true },
    refinements: [
      { op: "exclude", field: "country", values: ["CA"] },
    ],
  }, {
    dimensions: [
      {
        id: "country",
        runtimeFilter: {
          paramPath: "filters.country",
        },
      },
    ],
  }),
  {
    dimensions: { country: true },
    refinements: [
      { op: "exclude", field: "country", values: ["CA"] },
    ],
    filters: {},
  },
);

console.log("reportRuntimeRequestRefinementModel ✓ maps explicit runtime refinement metadata into backend request filters");
