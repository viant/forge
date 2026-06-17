import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredDerivedCompactSavedReportRecord();

assert.deepEqual(record, fixture);

console.log("authoredDerivedCompactSavedReportRecordFixture ✓ authored compact derived saved record stays aligned with generated runtime output");
