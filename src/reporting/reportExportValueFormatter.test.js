import assert from "node:assert/strict";

import { formatExportNumericValue, formatExportValue } from "./reportExportValueFormatter.js";
import { formatDisplayValue } from "../utils/formatValue.js";

assert.equal(formatExportNumericValue(13.151637212662237, "number"), "13.15164");
assert.equal(formatExportNumericValue(126329231621, "number"), "126,329,231,621");
assert.equal(formatExportNumericValue(95.000000409, "number5"), "95.00000");
assert.equal(formatExportNumericValue(25095562010, "compactNumber"), "25.1B");
assert.equal(formatExportNumericValue(153100, "compactNumber", { axis: true }), "153.1K");
assert.equal(formatExportNumericValue(548.8661, "currency"), "$549");
// Independently invented amounts: format affects presentation, never measurements.
for (const [format, expected] of [["currency", ["$1,235", "-$13"]], ["currency2", ["$1,234.75", "-$12.75"]]]) {
  for (const [index, value] of [1234.75, -12.75].entries()) {
    assert.equal(formatDisplayValue(value, format), expected[index]);
    assert.equal(formatExportValue(value, format), expected[index]);
    assert.equal(formatExportNumericValue(value, format, {axis: true}), expected[index]);
  }
  assert.equal(formatDisplayValue(null, format), "-");
  assert.equal(formatExportValue(null, format), "—");
}
assert.equal(formatExportValue({ start: "2026-07-08", end: "2026-07-08" }, "dateRange"), "2026-07-08 to 2026-07-08");
assert.equal(formatExportValue("2026-07-12T00:00:00Z", "date"), "Jul 12, 2026");

console.log("reportExportValueFormatter ✓ formats readable default and compact values for export");

assert.equal(formatExportNumericValue(.0065,"percentFraction2"),"0.65%");
assert.equal(formatExportNumericValue(null,"currency2"),"");
assert.equal(formatExportNumericValue(" ","number"),"");
assert.equal(formatExportValue(null,"percentFraction2"),"—");

for(const format of ['id','raw','plain','text']){
 assert.equal(formatExportValue(555785,format),'555785');
 assert.equal(formatExportValue('000123',format),'000123');
 assert.equal(formatExportValue('9007199254740993',format),'9007199254740993');
 assert.equal(formatExportNumericValue('000123',format),'000123');
}
