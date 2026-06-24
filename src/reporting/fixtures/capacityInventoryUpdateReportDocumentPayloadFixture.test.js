import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-inventory-update-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { updateReportDocumentPayload } = buildCapacityInventoryFixtureState();

assert.deepEqual(updateReportDocumentPayload, fixture);

console.log("capacityInventoryUpdateReportDocumentPayloadFixture ✓ seeded inventory update payload stays aligned with generated runtime output");
