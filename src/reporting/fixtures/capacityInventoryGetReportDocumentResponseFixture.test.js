import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-inventory-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { getReportDocumentResponse } = buildCapacityInventoryFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("capacityInventoryGetReportDocumentResponseFixture ✓ seeded inventory get response stays aligned with generated runtime output");
