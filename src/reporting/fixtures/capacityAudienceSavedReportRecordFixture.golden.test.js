import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

import { assertFixtureDeclaredRefinementFields } from "./assertFixtureDeclaredRefinementFields.js";

const fixtureUrl = new URL("./capacity-audience-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { record } = buildCapacityAudienceLandscapeFixtureState();

assertFixtureDeclaredRefinementFields(record.savedReportPayload);
assert.deepEqual(record, fixture);

console.log("capacityAudienceSavedReportRecordFixture ✓ seeded audience saved record stays aligned with generated runtime output");
