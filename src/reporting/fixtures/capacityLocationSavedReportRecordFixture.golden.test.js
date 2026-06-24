import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-location-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { record } = buildCapacityLocationFixtureState();

assert.deepEqual(record, fixture);

console.log("capacityLocationSavedReportRecordFixture ✓ seeded capacity location saved record stays aligned with generated runtime output");
