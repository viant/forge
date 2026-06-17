import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeMixedSavedReportRecord } from "./authoredLandscapeMixedSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-landscape-mixed-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredLandscapeMixedSavedReportRecord();

assert.deepEqual(record, fixture);

console.log("authoredLandscapeMixedSavedReportRecordFixture ✓ authored mixed saved record fixture stays aligned with generated mixed runtime output");
