import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildCapacityAudienceSegmentSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./capacity-audience-landscape-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildCapacityAudienceSegmentSavedReportRecord();
const reportPrint = record.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("capacityAudienceLandscapeReportPrintFixture ✓ seeded audience landscape print fixture stays aligned with generated runtime output");
