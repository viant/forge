import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { parseReportBuilderLocalImport } from "../../components/dashboard/reportBuilderLocalImport.js";
import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { exportRequest } = buildCapacityDirectSeriesFixtureState();
assert.deepEqual(exportRequest, fixture);

const staleFixture = JSON.parse(JSON.stringify(fixture));
staleFixture.reportPrint.fillVersion = 2;

assert.deepEqual(validateReportExportRequest(staleFixture), {
  valid: false,
  errors: [
    {
      path: "$.reportPrint.fillVersion",
      code: "invalidContract",
      message: "ReportPrint fillVersion must match reportFill.version.",
    },
  ],
});

const importedStaleFixture = parseReportBuilderLocalImport(JSON.stringify(staleFixture), {
  fileName: "capacity-direct-series.stale-export-request.json",
});

assert.equal(importedStaleFixture.valid, false);
assert.equal(importedStaleFixture.code, "invalidReportExportRequest");
assert.match(importedStaleFixture.message, /report export request failed validation/i);

console.log("capacityDirectSeriesStaleExportRequestFixture ✓ stale direct-series export request bundles are rejected by the canonical handoff contract");
