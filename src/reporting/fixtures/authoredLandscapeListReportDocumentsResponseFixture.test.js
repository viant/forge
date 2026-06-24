import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredLandscapeFixtureState } from "./authoredLandscapeFixtureState.js";

const fixtureUrl = new URL("./authored-landscape-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { listReportDocumentsResponse } = buildAuthoredLandscapeFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("authoredLandscapeListReportDocumentsResponseFixture ✓ seeded authored landscape list response stays aligned with generated runtime output");
