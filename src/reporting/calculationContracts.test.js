import assert from "node:assert/strict";

import {
  listReportCalculatedFieldFunctionSpecs,
  listReportCalculatedFieldTableCalculationSpecs,
  REPORT_CALCULATED_FIELD_FUNCTION_SPECS,
  REPORT_CALCULATED_FIELD_TABLE_CALC_SPECS,
} from "./calculationContracts.js";

assert.ok(Object.isFrozen(REPORT_CALCULATED_FIELD_FUNCTION_SPECS));
assert.ok(Object.isFrozen(REPORT_CALCULATED_FIELD_TABLE_CALC_SPECS));

assert.deepEqual(
  listReportCalculatedFieldFunctionSpecs().map((entry) => entry.name),
  [
    "abs",
    "case",
    "ceil",
    "coalesce",
    "concat",
    "floor",
    "greatest",
    "if",
    "isnull",
    "least",
    "lower",
    "max",
    "min",
    "nullif",
    "round",
    "upper",
  ],
);

assert.deepEqual(
  listReportCalculatedFieldTableCalculationSpecs().map((entry) => entry.name),
  [
    "deltaFromPrevious",
    "movingAverage",
    "percentOfTotal",
    "rank",
    "runningTotal",
  ],
);

console.log("calculationContracts ✓ exposes frozen calculated-field and table-calc spec catalogs");
