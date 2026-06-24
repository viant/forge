import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { listReportDocumentsResponse } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("capacityDirectSeriesListReportDocumentsResponseFixture ✓ seeded direct-series list response stays aligned with generated runtime output");
