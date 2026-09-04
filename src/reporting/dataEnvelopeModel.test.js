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
