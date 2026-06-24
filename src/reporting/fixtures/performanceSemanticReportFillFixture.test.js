import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportFill } from "../schema/reportSchemas.js";

const performanceFixtureUrl = new URL("./performance-report-fixtures.v1.json", import.meta.url);
const performanceFixtures = JSON.parse(readFileSync(performanceFixtureUrl, "utf8"));

const fixtureUrl = new URL("./performance-semantic-report-fill-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

assert.deepEqual(validateReportFill(fixture), { valid: true, errors: [] });
assert.deepEqual(performanceFixtures.semantic.reportFill, fixture);
assert.equal(fixture.datasets[0].provenance.truncated, true);
assert.equal(fixture.datasets[0].provenance.hasMore, true);
assert.equal(fixture.diagnostics[0].code, "truncated");

console.log("performanceSemanticReportFillFixture ✓ canonical truncated semantic ReportFill stays aligned with the seeded performance corpus");
