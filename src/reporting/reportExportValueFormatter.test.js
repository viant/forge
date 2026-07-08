import assert from "node:assert/strict";

import { formatExportNumericValue, formatExportValue } from "./reportExportValueFormatter.js";

assert.equal(formatExportNumericValue(13.151637212662237, "number"), "13.15164");
assert.equal(formatExportNumericValue(25095562010, "compactNumber"), "25 095 562 010");
assert.equal(formatExportNumericValue(153100, "compactNumber", { axis: true }), "153.1K");
assert.equal(formatExportNumericValue(548.8661, "currency"), "$548.87");
assert.equal(formatExportValue({ start: "2026-07-08", end: "2026-07-08" }, "dateRange"), "2026-07-08 to 2026-07-08");

console.log("reportExportValueFormatter ✓ formats default numbers to 5 decimals and compact values with spaced groups for export");
