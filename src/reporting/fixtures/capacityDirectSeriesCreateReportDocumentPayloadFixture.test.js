import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { createReportDocumentPayload } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("capacityDirectSeriesCreateReportDocumentPayloadFixture ✓ seeded direct-series create payload stays aligned with generated runtime output");
