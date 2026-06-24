import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-location-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { getReportDocumentResponse } = buildCapacityLocationFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("capacityLocationGetReportDocumentResponseFixture ✓ seeded location get response stays aligned with generated runtime output");
