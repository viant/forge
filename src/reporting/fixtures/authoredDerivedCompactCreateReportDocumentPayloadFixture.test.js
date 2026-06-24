import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-create-report-document-payload-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { createReportDocumentPayload } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(createReportDocumentPayload, fixture);

console.log("authoredDerivedCompactCreateReportDocumentPayloadFixture ✓ seeded authored-derived compact create payload stays aligned with generated runtime output");
