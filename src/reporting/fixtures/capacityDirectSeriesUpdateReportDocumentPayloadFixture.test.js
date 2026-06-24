import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityDirectSeriesFixtureState } from "./capacityDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./capacity-direct-series-update-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { updateReportDocumentPayload } = buildCapacityDirectSeriesFixtureState();

assert.deepEqual(updateReportDocumentPayload, fixture);

console.log("capacityDirectSeriesUpdateReportDocumentPayloadFixture ✓ seeded direct-series update payload stays aligned with generated runtime output");
