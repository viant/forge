import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("capacityDirectSeriesGetReportDocumentRequestFixture ✓ seeded direct-series get request stays aligned with generated runtime output");
