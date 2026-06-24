import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("capacityAudienceGetReportDocumentRequestFixture ✓ seeded audience get request stays aligned with generated runtime output");
