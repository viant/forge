import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { exportRequest } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("capacityDirectSeriesExportRequestFixture ✓ seeded direct-series export request fixture stays aligned with generated KPI blend saved export output");
