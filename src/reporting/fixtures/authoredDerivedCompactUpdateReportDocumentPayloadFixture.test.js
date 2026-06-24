import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-update-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { updateReportDocumentPayload } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(updateReportDocumentPayload, fixture);

console.log("authoredDerivedCompactUpdateReportDocumentPayloadFixture ✓ seeded authored-derived compact update payload stays aligned with generated runtime output");
