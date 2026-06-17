import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildAuthoredLandscapeMixedSavedReportRecord } from "./authoredLandscapeMixedSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-landscape-mixed-builder-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredLandscapeMixedSavedReportRecord();
const reportPrint = record.exportRequest.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("authoredLandscapeMixedBuilderReportPrintFixture ✓ authored mixed builder print fixture stays aligned with generated mixed runtime output");
