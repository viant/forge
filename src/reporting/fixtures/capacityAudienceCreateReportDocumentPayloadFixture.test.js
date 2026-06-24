import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { createReportDocumentPayload } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("capacityAudienceCreateReportDocumentPayloadFixture ✓ seeded audience create payload stays aligned with generated runtime output");
