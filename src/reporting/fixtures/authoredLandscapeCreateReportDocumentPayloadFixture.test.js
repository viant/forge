import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureUrl = new URL("./authored-landscape-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { createReportDocumentPayload } = buildAuthoredLandscapeFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("authoredLandscapeCreateReportDocumentPayloadFixture ✓ seeded authored landscape create payload stays aligned with generated runtime output");
