import assert from "node:assert/strict";

import { formatExportNumericValue, formatExportValue } from "./reportExportValueFormatter.js";

assert.equal(formatExportNumericValue(13.151637212662237, "number"), "13.15164");
assert.equal(formatExportNumericValue(126329231621, "number"), "126 329 231 621");
assert.equal(formatExportNumericValue(95.000000409, "number5"), "95.00000");
assert.equal(formatExportNumericValue(25095562010, "compactNumber"), "25.1B");
assert.equal(formatExportNumericValue(153100, "compactNumber", { axis: true }), "153.1K");
assert.equal(formatExportNumericValue(548.8661, "currency"), "$548.87");
assert.equal(formatExportValue({ start: "2026-07-08", end: "2026-07-08" }, "dateRange"), "2026-07-08 to 2026-07-08");
assert.equal(formatExportValue("2026-07-12T00:00:00Z", "date"), "Jul 12, 2026");

console.log("reportExportValueFormatter ✓ formats readable default and compact values for export");
