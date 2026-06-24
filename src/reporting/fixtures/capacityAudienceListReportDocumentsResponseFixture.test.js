import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { listReportDocumentsResponse } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("capacityAudienceListReportDocumentsResponseFixture ✓ seeded audience list response stays aligned with generated runtime output");
