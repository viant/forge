import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";

const fixtureUrl = new URL("./capacity-location-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildCapacityLocationFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("capacityLocationGetReportDocumentRequestFixture ✓ seeded location get request stays aligned with generated runtime output");
