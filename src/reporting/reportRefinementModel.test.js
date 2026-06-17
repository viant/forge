import assert from "node:assert/strict";

import {
  normalizeReportRefinement,
  normalizeReportRefinements,
} from "./reportRefinementModel.js";

assert.equal(normalizeReportRefinement(null), null);
assert.equal(normalizeReportRefinement({ op: "unknown" }), null);
assert.equal(normalizeReportRefinement({ op: "keep", field: "" }), null);

assert.deepEqual(normalizeReportRefinement({
  op: " keep ",
  field: " region ",
  values: ["EMEA", "APAC"],
  sourceBlockId: "summaryChart",
  label: "Keep EMEA/APAC",
}), {
  id: "keep:region:summaryChart",
  op: "keep",
  field: "region",
  values: ["EMEA", "APAC"],
  sourceBlockId: "summaryChart",
  label: "Keep EMEA/APAC",
});

assert.deepEqual(normalizeReportRefinement({
  id: "detail_1",
  op: "detail",
  field: "orderId",
  values: [2667545],
  targetRef: "target://steward/performance/order-detail",
}), {
  id: "detail_1",
  op: "detail",
  field: "orderId",
  values: [2667545],
  targetRef: "target://steward/performance/order-detail",
});

assert.deepEqual(normalizeReportRefinements([
  {
    id: "ref_1",
    op: "keep",
    field: "region",
    values: ["EMEA"],
    sourceBlockId: "summaryChart",
  },
  {
    id: "ref_1",
    op: "keep",
    field: "region",
    values: ["EMEA"],
    sourceBlockId: "summaryChart",
  },
  {
    op: "exclude",
    field: "channel",
    values: ["CTV"],
    sourceBlockId: "table_1",
  },
]), [
  {
    id: "ref_1",
    op: "keep",
    field: "region",
    values: ["EMEA"],
    sourceBlockId: "summaryChart",
  },
  {
    id: "exclude:channel:table_1",
    op: "exclude",
    field: "channel",
    values: ["CTV"],
    sourceBlockId: "table_1",
  },
]);

console.log("reportRefinementModel ✓ normalizes generic report refinement contracts");
