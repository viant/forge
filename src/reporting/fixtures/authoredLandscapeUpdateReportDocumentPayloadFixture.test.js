import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureUrl = new URL("./authored-landscape-update-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { updateReportDocumentPayload } = buildAuthoredLandscapeFixtureState();

assert.deepEqual(updateReportDocumentPayload, fixture);

console.log("authoredLandscapeUpdateReportDocumentPayloadFixture ✓ seeded authored landscape update payload stays aligned with generated runtime output");
