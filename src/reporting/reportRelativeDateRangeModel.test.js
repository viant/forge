import assert from "node:assert/strict";

import {
  formatReportRelativeTime,
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
