import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildAuthoredLandscapeSavedReportRecord } from "./authoredLandscapeSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-landscape-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredLandscapeSavedReportRecord();
const exportRequest = record.exportRequest;

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("authoredLandscapeExportRequestFixture ✓ seeded authored landscape export request fixture stays aligned with generated runtime output");
