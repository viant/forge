import assert from "node:assert/strict";
import test from "node:test";

import { extractData } from "./dataEnvelopeModel.js";

test("extractData converts a selected diagnostic CSV dataset to typed rows", () => {
  const result = extractData(
    { data: "factDatasets.delivery_pacing" },
    null,
    {
      factDatasets: {
        delivery_pacing: {
          columns: ["entityId", "bids", "status"],
          rowCount: 1,
          csv: "entityId,bids,status\n2672373,1647618,behind\n",
        },
      },
    },
  );

  assert.deepEqual(result.records, [{
    entityId: 2672373,
    bids: 1647618,
    status: "behind",
  }]);
});

test("extractData preserves root-array records with a redundant legacy data selector", () => {
  const rows = [{ id: "draft-1", name: "" }];
  const result = extractData({ data: "data" }, null, rows);

  assert.deepEqual(result.records, rows);
});

test("extractData converts a selected typed tabular dataset into object rows", () => {
  const result = extractData({ data: "data.0" }, null, {
    data: [{
      name: "overview",
      columns: [{ name: "campaign" }, { name: "impressions" }],
      rows: [["Campaign A", 42], ["Campaign B"]],
    }],
  });
  assert.deepEqual(result.records, [
    { campaign: "Campaign A", impressions: 42 },
    { campaign: "Campaign B", impressions: null },
  ]);
});

test("extractData converts a BFF-normalized singleton tabular collection", () => {
  const result = extractData({ data: "data.0" }, null, {
    rows: [{
      name: "conversionDevices",
      columns: [{ name: "campaignId" }, { name: "impressions" }],
      rows: [[544632, 5886978], [544349, 1048680]],
    }],
    metrics: { viewId: 1342 },
  });

  assert.deepEqual(result.records, [
    { campaignId: 544632, impressions: 5886978 },
    { campaignId: 544349, impressions: 1048680 },
  ]);
  assert.deepEqual(result.stats, { viewId: 1342 });
});
