import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildCapacityLocationsTopMarketsLandscapeSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./capacity-location-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildCapacityLocationsTopMarketsLandscapeSavedReportRecord();
const exportRequest = record.exportRequest;

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("capacityLocationExportRequestFixture ✓ seeded capacity location export request fixture stays aligned with generated runtime output");
