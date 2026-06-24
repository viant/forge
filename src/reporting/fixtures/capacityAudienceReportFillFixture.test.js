import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportFill } from "../schema/reportSchemas.js";
import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-report-fill-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { reportFill } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(validateReportFill(fixture), { valid: true, errors: [] });
assert.deepEqual(reportFill, fixture);

console.log("capacityAudienceReportFillFixture ✓ canonical semantic audience ReportFill stays aligned with generated runtime output");
