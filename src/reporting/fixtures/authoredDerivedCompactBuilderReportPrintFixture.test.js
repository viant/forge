import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-builder-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredDerivedCompactSavedReportRecord();
const reportPrint = record.exportRequest.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("authoredDerivedCompactBuilderReportPrintFixture ✓ authored compact derived builder print fixture stays aligned with generated runtime output");
