import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-list-report-documents-response-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { listReportDocumentsResponse } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(listReportDocumentsResponse, fixture);

console.log("authoredDerivedCompactListReportDocumentsResponseFixture ✓ seeded authored-derived compact list response stays aligned with generated runtime output");
