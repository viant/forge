import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureUrl = new URL("./authored-landscape-get-report-document-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { getReportDocumentRequest } = buildAuthoredLandscapeFixtureState();

assert.deepEqual(getReportDocumentRequest, fixture);

console.log("authoredLandscapeGetReportDocumentRequestFixture ✓ seeded authored landscape get request stays aligned with generated runtime output");
