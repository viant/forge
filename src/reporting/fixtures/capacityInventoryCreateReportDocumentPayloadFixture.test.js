import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-inventory-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { createReportDocumentPayload } = buildCapacityInventoryFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("capacityInventoryCreateReportDocumentPayloadFixture ✓ seeded inventory create payload stays aligned with generated runtime output");
