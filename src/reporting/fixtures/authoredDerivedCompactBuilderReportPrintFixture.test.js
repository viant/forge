import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateReportPrint } from "../schema/reportSchemas.js";
import { buildAuthoredDerivedCompactSavedReportRecord } from "./authoredDerivedCompactSavedReportRecordBuilder.js";

const fixtureUrl = new URL("./authored-derived-compact-builder-report-print-fixture.v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

const record = buildAuthoredDerivedCompactSavedReportRecord();
const reportPrint = record.exportRequest.reportPrint;

assert.deepEqual(validateReportPrint(reportPrint), { valid: true, errors: [] });
const continued = reportPrint.pages[2]?.elements.find((element) => element.text === "Reach Rate Table (continued)");
assert.equal(continued?.id, "reachRateTable__title_page_3_0", "continued table title has a page-specific element identity");
assert.equal(reportPrint.bookmarks.filter((bookmark) => bookmark.id === "bookmark.reachRateTable").length, 1, "continuation does not duplicate the table bookmark");
const elementIds = reportPrint.pages.flatMap((page) => page.elements.map((element) => element.id));
assert.equal(new Set(elementIds).size, elementIds.length, "print elements have unique cross-page identities");
assert.equal(new Set(reportPrint.bookmarks.map((bookmark) => bookmark.id)).size, reportPrint.bookmarks.length, "print bookmarks have unique identities");
assert.deepEqual(reportPrint, fixture);

console.log("authoredDerivedCompactBuilderReportPrintFixture ✓ authored compact derived builder print fixture stays aligned with generated runtime output");
