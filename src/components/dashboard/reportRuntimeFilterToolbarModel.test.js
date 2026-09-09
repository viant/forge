import assert from "node:assert/strict";

import { buildReportRuntimeFilterToolbarModel } from "./reportRuntimeFilterToolbarModel.js";

assert.deepEqual(buildReportRuntimeFilterToolbarModel([]), { visible: false, activeCount: 0, filters: [] });
const filters = [
  { id: "date", value: { start: "2026-01-01", end: "2026-01-31" } },
  { id: "channel", value: ["display"] },
  { id: "market", value: ["US"], enabled: false },
];
const model = buildReportRuntimeFilterToolbarModel([{ content: { params: filters } }]);
assert.equal(model.visible, true);
assert.equal(model.activeCount, 2);
assert.equal(model.filters.length, 3);
