import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildForecastDirectSeriesFixtureState } from "./forecastDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./forecast-direct-series-landscape-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { reportPrint } = buildForecastDirectSeriesFixtureState();

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("forecastDirectSeriesLandscapeReportPrintFixture ✓ seeded direct-series landscape print fixture stays aligned with generated KPI blend runtime output");
