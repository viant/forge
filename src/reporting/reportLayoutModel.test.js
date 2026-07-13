import assert from "node:assert/strict";

import {
  REPORT_LAYOUT_GRID_COLUMNS,
  REPORT_LAYOUT_SPAN_PRESETS,
  buildReportLayoutItem,
  resolveReportLayoutSnappedSpan,
  resolveNextReportLayoutSpan,
  resolveReportLayoutPreset,
  resolveReportLayoutSpan,
} from "./reportLayoutModel.js";

assert.equal(REPORT_LAYOUT_GRID_COLUMNS, 12);

assert.deepEqual(REPORT_LAYOUT_SPAN_PRESETS, [
  { span: 12, label: "Full" },
  { span: 8, label: "Two-thirds" },
  { span: 6, label: "Half" },
  { span: 4, label: "Third" },
  { span: 3, label: "Quarter" },
]);

assert.equal(resolveReportLayoutSpan(null), 12);
assert.equal(resolveReportLayoutSpan("full"), 12);
assert.equal(resolveReportLayoutSpan("2/3"), 8);
assert.equal(resolveReportLayoutSpan("two-thirds"), 8);
assert.equal(resolveReportLayoutSpan("half"), 6);
assert.equal(resolveReportLayoutSpan("1/3"), 4);
assert.equal(resolveReportLayoutSpan("third"), 4);
assert.equal(resolveReportLayoutSpan("quarter"), 3);
assert.equal(resolveReportLayoutSpan("1/4"), 3);
assert.equal(resolveReportLayoutSpan({ size: "quarter" }), 3);
assert.equal(resolveReportLayoutSpan({ span: 5 }), 5);

assert.deepEqual(resolveReportLayoutPreset(12), { span: 12, label: "Full" });
assert.deepEqual(resolveReportLayoutPreset(8), { span: 8, label: "Two-thirds" });
assert.deepEqual(resolveReportLayoutPreset(6), { span: 6, label: "Half" });
assert.deepEqual(resolveReportLayoutPreset(4), { span: 4, label: "Third" });
assert.deepEqual(resolveReportLayoutPreset(3), { span: 3, label: "Quarter" });
assert.deepEqual(resolveReportLayoutPreset(5), { span: 5, label: "5/12" });

assert.equal(resolveNextReportLayoutSpan(12), 8);
assert.equal(resolveNextReportLayoutSpan(8), 6);
assert.equal(resolveNextReportLayoutSpan(6), 4);
assert.equal(resolveNextReportLayoutSpan(4), 3);
assert.equal(resolveNextReportLayoutSpan(3), 12);

assert.equal(resolveReportLayoutSnappedSpan({ clientX: 0, left: 0, width: 1200 }), 1);
assert.equal(resolveReportLayoutSnappedSpan({ clientX: 300, left: 0, width: 1200 }), 3);
assert.equal(resolveReportLayoutSnappedSpan({ clientX: 600, left: 0, width: 1200 }), 6);
assert.equal(resolveReportLayoutSnappedSpan({ clientX: 800, left: 0, width: 1200 }), 8);
assert.equal(resolveReportLayoutSnappedSpan({ clientX: 1200, left: 0, width: 1200 }), 12);
assert.equal(resolveReportLayoutSnappedSpan({ clientX: 1500, left: 0, width: 1200 }), 12);

assert.deepEqual(buildReportLayoutItem("headlineKpi", { size: "quarter" }), {
  blockId: "headlineKpi",
  span: 3,
});
assert.deepEqual(buildReportLayoutItem("headlineKpi", { size: "half" }, { preserveLegacyHalf: true }), {
  blockId: "headlineKpi",
  size: "half",
});

console.log("reportLayoutModel ✓ resolves a 12-column layout model with friendly preset labels");
