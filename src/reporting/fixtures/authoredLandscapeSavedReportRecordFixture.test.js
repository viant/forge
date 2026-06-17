import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeSavedReportRecord } from "./authoredLandscapeSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-landscape-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredLandscapeSavedReportRecord();

assert.deepEqual(record, fixture);

console.log("authoredLandscapeSavedReportRecordFixture ✓ authored landscape saved record fixture stays aligned with generated runtime output");
