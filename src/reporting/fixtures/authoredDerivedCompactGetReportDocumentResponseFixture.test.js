import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentResponse } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("authoredDerivedCompactGetReportDocumentResponseFixture ✓ seeded authored-derived compact get response stays aligned with generated runtime output");
