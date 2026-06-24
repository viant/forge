import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentResponse } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("capacityAudienceGetReportDocumentResponseFixture ✓ seeded audience get response stays aligned with generated runtime output");
