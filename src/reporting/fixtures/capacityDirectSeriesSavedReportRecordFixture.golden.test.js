import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { record } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(record, fixture);

console.log("capacityDirectSeriesSavedReportRecordFixture ✓ seeded direct-series saved record stays aligned with generated KPI blend runtime output");
