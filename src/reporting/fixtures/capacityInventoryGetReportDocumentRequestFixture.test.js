import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";

const fixtureUrl = new URL("./capacity-inventory-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildCapacityInventoryFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("capacityInventoryGetReportDocumentRequestFixture ✓ seeded inventory get request stays aligned with generated runtime output");
