import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("authoredDerivedCompactGetReportDocumentRequestFixture ✓ seeded authored-derived compact get request stays aligned with generated runtime output");
