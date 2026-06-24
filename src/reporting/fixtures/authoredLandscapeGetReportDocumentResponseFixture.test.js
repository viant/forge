import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureUrl = new URL("./authored-landscape-get-report-document-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentResponse } = buildAuthoredLandscapeFixtureState();

assert.deepEqual(getReportDocumentResponse, fixture);

console.log("authoredLandscapeGetReportDocumentResponseFixture ✓ seeded authored landscape get response stays aligned with generated runtime output");
