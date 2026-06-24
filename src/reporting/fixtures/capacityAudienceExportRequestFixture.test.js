import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildCapacityAudienceLandscapeFixtureState } from "./capacityAudienceLandscapeFixtureState.js";

const fixtureUrl = new URL("./capacity-audience-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { exportRequest } = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("capacityAudienceExportRequestFixture ✓ seeded audience export request fixture stays aligned with generated runtime output");
