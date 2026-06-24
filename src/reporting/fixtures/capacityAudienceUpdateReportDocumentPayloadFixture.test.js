import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-update-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { updateReportDocumentPayload } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(updateReportDocumentPayload, fixture);

console.log("capacityAudienceUpdateReportDocumentPayloadFixture ✓ seeded audience update payload stays aligned with generated runtime output");
