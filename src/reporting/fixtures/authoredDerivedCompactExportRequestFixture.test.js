import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildAuthoredDerivedCompactFixtureState } from "./authoredDerivedCompactFixtureState.js";

const fixtureUrl = new URL("./authored-derived-compact-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { exportRequest } = buildAuthoredDerivedCompactFixtureState();

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("authoredDerivedCompactExportRequestFixture ✓ seeded authored-derived compact export request stays aligned with generated runtime output");
