import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildCapacityInventoryTopChannelsLandscapeSavedReportRecord } from "./capacityPreviewSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./capacity-inventory-landscape-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildCapacityInventoryTopChannelsLandscapeSavedReportRecord();
const reportPrint = record.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
const narrativePage = reportPrint.pages.find((page) => page.elements.some((element) => element.id === "narrativeIntro__title_0"));
const kpiPage = reportPrint.pages.find((page) => page.elements.some((element) => element.id === "headlineKpi__card"));
assert.equal(narrativePage?.number, kpiPage?.number, "the authored half-width narrative and KPI must stay on one print page");
assert.deepEqual(reportPrint, fixture);

console.log("capacityInventoryLandscapeReportPrintFixture ✓ seeded capacity inventory landscape print fixture stays aligned with generated template runtime output");
