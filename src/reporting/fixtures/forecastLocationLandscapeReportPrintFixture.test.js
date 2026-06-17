import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildForecastLocationsTopMarketsLandscapeSavedReportRecord } from "./forecastPreviewSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./forecast-location-landscape-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildForecastLocationsTopMarketsLandscapeSavedReportRecord();
const reportPrint = record.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
assert.deepEqual(reportPrint, fixture);

console.log("forecastLocationLandscapeReportPrintFixture ✓ seeded forecast location landscape print fixture stays aligned with generated template runtime output");
