import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildForecastDirectSeriesFixtureState } from "./forecastDirectSeriesFixtureState.js";

const fixtureUrl = new URL("./forecast-direct-series-saved-report-record-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const { record } = buildForecastDirectSeriesFixtureState();

assert.deepEqual(record, fixture);

console.log("forecastDirectSeriesSavedReportRecordFixture ✓ seeded direct-series saved record stays aligned with generated KPI blend runtime output");
