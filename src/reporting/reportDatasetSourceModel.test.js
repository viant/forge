import assert from "node:assert/strict";

import {
  isReportDatasetMCPSource,
  normalizeReportDatasetCapabilities,
  normalizeReportDatasetSource,
  resolveReportDatasetSourceToolName,
} from "./reportDatasetSourceModel.js";

assert.equal(normalizeReportDatasetSource(null), null);
assert.equal(normalizeReportDatasetCapabilities(null), null);

assert.deepEqual(
  normalizeReportDatasetSource({
    kind: " MCPTOOL ",
    server: " steward ",
    tool: " steward:MetricsAdCube ",
    profile: " datly.unified_cube ",
    contractRef: " steward://metrics/performance_cube ",
    ignoredArray: [],
  }),
  {
    kind: "mcp_tool",
    server: "steward",
    tool: "steward:MetricsAdCube",
    profile: "datly.unified_cube",
    contractRef: "steward://metrics/performance_cube",
    ignoredArray: [],
  },
);

assert.equal(
  resolveReportDatasetSourceToolName({
    kind: "mcp",
    tool: "demo:summary",
  }),
  "demo:summary",
);

assert.equal(
  resolveReportDatasetSourceToolName({
    kind: "mcp_tool",
    toolName: "demo:summary_v2",
  }),
  "demo:summary_v2",
);

assert.equal(
  isReportDatasetMCPSource({
    kind: "mcp_tool",
    tool: "demo:summary",
  }),
  true,
);

assert.equal(
  isReportDatasetMCPSource({
    kind: "inline",
    tool: "demo:summary",
  }),
  false,
);

assert.deepEqual(
  normalizeReportDatasetCapabilities({
    fieldCatalog: 1,
    backendRefetch: true,
    liveFilters: "yes",
    requestModel: {
      measuresPath: " measures ",
      dimensionsPath: " dimensions ",
      filtersPath: " filters ",
      orderByPath: " orderBy ",
      limitPath: " limit ",
      offsetPath: " offset ",
      emptyPath: " ",
    },
    provider: {
      datly: {
        unifiedCube: true,
      },
    },
    datly: {
      unifiedCube: true,
    },
  }),
  {
    fieldCatalog: false,
    backendRefetch: true,
    liveFilters: false,
    requestModel: {
      measuresPath: "measures",
      dimensionsPath: "dimensions",
      filtersPath: "filters",
      orderByPath: "orderBy",
      limitPath: "limit",
      offsetPath: "offset",
      emptyPath: " ",
    },
    provider: {
      datly: {
        unifiedCube: true,
      },
    },
    datly: {
      unifiedCube: true,
    },
  },
);

console.log("reportDatasetSourceModel ✓ normalizes generic MCP dataset source and capability metadata");
