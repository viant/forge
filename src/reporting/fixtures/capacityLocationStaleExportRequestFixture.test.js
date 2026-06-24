import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { parseReportBuilderLocalImport } from "../../components/dashboard/reportBuilderLocalImport.js";
import { buildCapacityLocationsTopMarketsLandscapeSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./capacity-location-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildCapacityLocationsTopMarketsLandscapeSavedReportRecord();
assert.deepEqual(record.exportRequest, fixture);

const staleFixture = JSON.parse(JSON.stringify(fixture));
staleFixture.reportPrint.specHash = "fnv1a:deadbeef";

assert.deepEqual(validateReportExportRequest(staleFixture), {
  valid: false,
  errors: [
    {
      path: "$.reportPrint.specHash",
      code: "invalidContract",
      message: "ReportPrint specHash must match reportSpec.",
    },
  ],
});

const importedStaleFixture = parseReportBuilderLocalImport(JSON.stringify(staleFixture), {
  fileName: "capacity-location.stale-export-request.json",
});

assert.equal(importedStaleFixture.valid, false);
assert.equal(importedStaleFixture.code, "invalidReportExportRequest");
assert.match(importedStaleFixture.message, /report export request failed validation/i);

console.log("capacityLocationStaleExportRequestFixture ✓ stale capacity location export request bundles are rejected by the canonical handoff contract");
