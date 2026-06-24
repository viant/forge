import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCapacityLocationFixtureState } from "./capacityLocationFixtureState.js";
import { normalizeTemplateIdentityFixture } from "./normalizeTemplateIdentityFixture.js";

const fixtureUrl = new URL("./capacity-location-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = normalizeTemplateIdentityFixture(JSON.parse(readFileSync(fixtureUrl, "utf8")));

const { createReportDocumentPayload } = buildCapacityLocationFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("capacityLocationCreateReportDocumentPayloadFixture ✓ seeded location create payload stays aligned with generated runtime output");
