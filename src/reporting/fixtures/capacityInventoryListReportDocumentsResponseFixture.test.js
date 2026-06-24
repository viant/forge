import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-inventory-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { listReportDocumentsResponse } = buildCapacityInventoryFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("capacityInventoryListReportDocumentsResponseFixture ✓ seeded inventory list response stays aligned with generated runtime output");
