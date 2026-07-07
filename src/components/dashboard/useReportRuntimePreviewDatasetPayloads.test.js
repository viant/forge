import assert from "node:assert/strict";

import { fetchReportRuntimePreviewDatasetPayloads } from "./useReportRuntimePreviewDatasetPayloads.js";

const builderContext = {
  Context(dataSourceRef) {
    if (dataSourceRef === "forecastCubeSource") {
      return {
        dataSource: {
          selectors: {
            data: "data",
          },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords({ parameters, requestKind }) {
              assert.equal(requestKind, "runtimePreviewDataset");
              assert.deepEqual(parameters, {
                measures: { forecastRevenue: true },
                dimensions: { region: true },
                filters: { region: ["US/NY"] },
                limit: 25,
                offset: 0,
              });
              return {
                data: [
                  { region: "US/NY", forecastRevenue: 1200 },
                  { region: "US/NJ", forecastRevenue: 950 },
                ],
              };
            },
          },
        },
      };
    }
    if (dataSourceRef === "brokenSource") {
      return {
        dataSource: {
          selectors: {
            data: "data",
          },
          paging: null,
        },
        handlers: {
          dataSource: {
            async fetchRecords() {
              throw new Error("Boom");
            },
          },
        },
      };
    }
    return {
      dataSource: {},
      handlers: {
        dataSource: {},
      },
    };
  },
};

const payloads = await fetchReportRuntimePreviewDatasetPayloads({
  builderContext,
  datasets: [
    {
      id: "forecast_cube",
      dataSourceRef: "forecastCubeSource",
      label: "Forecast Cube",
      request: {
        measures: { forecastRevenue: true },
        dimensions: { region: true },
        filters: { region: ["US/NY"] },
        limit: 25,
        offset: 0,
      },
    },
    {
      id: "broken_cube",
      dataSourceRef: "brokenSource",
      label: "Broken Cube",
      request: {
        measures: { totalSpend: true },
        dimensions: { channelId: true },
        filters: {},
        limit: 10,
        offset: 0,
      },
    },
    {
      id: "missing_cube",
      dataSourceRef: "missingSource",
      label: "Missing Cube",
      request: {
        measures: { totalSpend: true },
        dimensions: { channelId: true },
        filters: {},
        limit: 10,
        offset: 0,
      },
    },
  ],
});

assert.deepEqual(payloads.forecast_cube, {
  rows: [
    { region: "US/NY", forecastRevenue: 1200 },
    { region: "US/NJ", forecastRevenue: 950 },
  ],
  hasMore: false,
  diagnostics: [],
});
assert.equal(payloads.broken_cube.rows.length, 0);
assert.equal(payloads.broken_cube.diagnostics[0].code, "runtimePreviewDatasetFetchFailed");
assert.equal(payloads.missing_cube.rows.length, 0);
assert.equal(payloads.missing_cube.diagnostics[0].code, "runtimePreviewDatasetUnavailable");

console.log("useReportRuntimePreviewDatasetPayloads ✓ fetches published secondary dataset rows and degrades to diagnostics on failure");
