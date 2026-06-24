import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentResponse } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("capacityDirectSeriesGetReportDocumentResponseFixture ✓ seeded direct-series get response stays aligned with generated runtime output");
