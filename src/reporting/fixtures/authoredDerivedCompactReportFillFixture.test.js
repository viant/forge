import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportFill } from "../schema/reportSchemas.js";
import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-report-fill-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredDerivedCompactSavedReportRecord();
const reportFill = record.exportRequest.reportFill;

assert.deepEqual(validateReportFill(fixture), { valid: true, errors: [] });
assert.deepEqual(reportFill, fixture);

console.log("authoredDerivedCompactReportFillFixture ✓ canonical authored-derived ReportFill stays aligned with generated runtime output");
