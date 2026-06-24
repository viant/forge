import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-location-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { listReportDocumentsResponse } = buildCapacityLocationFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("capacityLocationListReportDocumentsResponseFixture ✓ seeded location list response stays aligned with generated runtime output");
