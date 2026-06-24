import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-inventory-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { record } = buildCapacityInventoryFixtureState();

assert.deepEqual(record, fixture);

console.log("capacityInventorySavedReportRecordFixture ✓ seeded capacity inventory saved record stays aligned with generated runtime output");
