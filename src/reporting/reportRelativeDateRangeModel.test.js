import assert from "node:assert/strict";

import {
  formatReportRelativeTime,
  resolveReportPreviousPeriodRange,
  resolveReportRelativeDateRange,
  resolveReportRelativeDateRangeSpec,
} from "./reportRelativeDateRangeModel.js";

const now = new Date("2026-07-15T12:30:00.000Z");
assert.deepEqual(resolveReportRelativeDateRange("today", now), { start: "2026-07-15", end: "2026-07-15" });
assert.deepEqual(resolveReportRelativeDateRange("yesterday", now), { start: "2026-07-14", end: "2026-07-14" });
assert.deepEqual(resolveReportRelativeDateRange("last_7_days", now), { start: "2026-07-09", end: "2026-07-15" });
assert.equal(resolveReportRelativeDateRange("quarter_to_date", now), null);
assert.equal(formatReportRelativeTime("2 days ago in UTC", { now }), "2026-07-13");
assert.equal(formatReportRelativeTime("50 hours ahead", { now, format: "dateTime" }), "2026-07-17T14:30:00.000Z");
assert.deepEqual(resolveReportRelativeDateRangeSpec({
  startExpression: "6 days ago",
  endExpression: "today",
}, now), { start: "2026-07-09", end: "2026-07-15" });

console.log("reportRelativeDateRangeModel ✓ resolves reusable dataset date windows");

for (const [start, end, previousStart, previousEnd] of [
  ["2026-09-21", "2026-10-20", "2026-08-22", "2026-09-20"],
  ["2026-01-01", "2026-01-01", "2025-12-31", "2025-12-31"],
  ["2024-03-01", "2024-03-02", "2024-02-28", "2024-02-29"],
  ["2026-03-08", "2026-03-14", "2026-03-01", "2026-03-07"],
  ["2026-11-01", "2026-11-07", "2026-10-25", "2026-10-31"],
]) assert.deepEqual(resolveReportPreviousPeriodRange(start, end), { start: previousStart, end: previousEnd });
for (const [start, end] of [["", "2026-01-01"], ["2026-02-30", "2026-03-02"],
  ["2026-01-02", "2026-01-01"], ["2026-1-01", "2026-01-02"], [null, null],
  ["0000-01-01", "0000-01-01"], ["0001-01-01", "0001-01-01"]]) {
  assert.throws(() => resolveReportPreviousPeriodRange(start, end), /Previous period/);
}
