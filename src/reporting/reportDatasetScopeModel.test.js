import assert from "node:assert/strict";

import {
  normalizeReportDatasetScope,
  resolveReportDatasetScopePolicy,
} from "./reportDatasetScopeModel.js";

assert.equal(normalizeReportDatasetScope(null), null);

assert.deepEqual(normalizeReportDatasetScope({
  mode: " APPEND ",
  local: {
    grain: "day",
  },
  exclude: [" audienceIds ", "", "audienceIds", "campaignIds"],
}), {
  mode: "append",
  local: {
    grain: "day",
  },
  exclude: ["audienceIds", "campaignIds"],
});

assert.deepEqual(resolveReportDatasetScopePolicy(null), {
  mode: "inherit",
  local: {},
  exclude: [],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  inheritContext: true,
}), {
  mode: "inherit",
  local: {},
  exclude: [],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  inheritContext: true,
  grain: "day",
}), {
  mode: "append",
  local: {
    grain: "day",
  },
  exclude: [],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  inheritContext: false,
  reportingWindow: "last_7_days",
}), {
  mode: "override",
  local: {
    reportingWindow: "last_7_days",
  },
  exclude: [],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  mode: "",
  local: {
    grain: "day",
  },
}), {
  mode: "append",
  local: {
    grain: "day",
  },
  exclude: [],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  inheritContext: true,
  exclude: ["audienceIds"],
}), {
  mode: "exclude",
  local: {},
  exclude: ["audienceIds"],
});

assert.deepEqual(resolveReportDatasetScopePolicy({
  mode: "exclude",
  local: {
    grain: "day",
  },
  exclude: ["audienceIds", "campaignIds", "audienceIds"],
}), {
  mode: "exclude",
  local: {
    grain: "day",
  },
  exclude: ["audienceIds", "campaignIds"],
});

assert.throws(
  () => normalizeReportDatasetScope({
    mode: "overide",
    local: {
      grain: "day",
    },
  }),
  /Unknown dataset scope mode 'overide'\./,
);

assert.throws(
  () => normalizeReportDatasetScope({
    mode: "exclude",
    exclude: [],
  }),
  /Dataset scope mode 'exclude' requires at least one excluded scope param id\./,
);

assert.throws(
  () => resolveReportDatasetScopePolicy({
    inheritContext: false,
    exclude: ["audienceIds"],
  }),
  /Legacy dataset scope cannot combine inheritContext=false with exclude entries\./,
);

console.log("reportDatasetScopeModel ✓ normalizes and resolves compatibility-first dataset scope policies");
