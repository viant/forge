import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportExportRequest } from "../schema/reportSchemas.js";
import { buildCapacityInventoryFixtureState } from "./capacityInventoryFixtureState.js";

const fixtureUrl = new URL("./capacity-inventory-export-request-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { exportRequest } = buildCapacityInventoryFixtureState();

assert.deepEqual(validateReportExportRequest(exportRequest), { valid: true, errors: [] });
assert.deepEqual(exportRequest, fixture);

console.log("capacityInventoryExportRequestFixture ✓ seeded capacity inventory export request fixture stays aligned with generated runtime output");
