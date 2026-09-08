import assert from "node:assert/strict";

import {
  resolveReportDatasetFetchResult,
} from "./reportDatasetResultContract.js";

const result = resolveReportDatasetFetchResult({
  body: {
    status: "ok",
    data: [{
      name: "performance",
      columns: [
        { name: "campaignName", type: "string", role: "dimension" },
        { name: "impressions", type: "integer", role: "measure" },
      ],
      rows: [
        ["Campaign A", 1200],
        ["Campaign B"],
      ],
    }],
  },
  resultContract: {
    shape: "tabular",
    rowPath: "data.0",
  },
});

assert.deepEqual(result, {
  rows: [
    { campaignName: "Campaign A", impressions: 1200 },
    { campaignName: "Campaign B", impressions: null },
  ],
  hasMore: false,
});

const invalid = resolveReportDatasetFetchResult({
  body: { data: [{ columns: [{ type: "string" }], rows: [["missing name"]] }] },
  resultContract: { shape: "tabular", rowPath: "data.0" },
});
assert.deepEqual(invalid.rows, []);

console.log("reportDatasetResultContract ✓ converts typed tabular envelopes into report-engine rows");
