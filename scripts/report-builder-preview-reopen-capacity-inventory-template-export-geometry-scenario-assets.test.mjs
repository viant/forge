import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import scenario from "../tests/report-builder-preview-semantic-reopen-capacity-inventory-template-export-geometry.scenario.mjs";

const scenarioSource = readFileSync(
  new URL("../tests/report-builder-preview-semantic-reopen-capacity-inventory-template-export-geometry.scenario.mjs", import.meta.url),
  "utf8",
);

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

const exportRequestFixture = JSON.parse(readFileSync(
  new URL("../src/reporting/fixtures/capacity-inventory-export-request-fixture.v1.json", import.meta.url),
  "utf8",
));

const expectedReportPrintSignature = {
  pageGeometry: exportRequestFixture.reportPrint.pageGeometry,
  pages: (exportRequestFixture.reportPrint.pages || []).map((page) => ({
    number: page.number,
    elements: (page.elements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    headerElements: (page.headerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
    footerElements: (page.footerElements || []).map(({ id, kind, box, text = null }) => ({ id, kind, box, text })),
  })),
  diagnostics: exportRequestFixture.reportPrint.diagnostics || [],
};

const exactSignatureLiteral = JSON.stringify(JSON.stringify(expectedReportPrintSignature));
const exactSignatureOccurrences = expressions.filter((expression) => expression.includes(exactSignatureLiteral)).length;

assert.equal(scenarioSource.includes("!window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession"), true);
assert.equal(exactSignatureOccurrences >= 2, true);

assert.equal(
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTemplateId === 'capacity_inventory_brief'") && expression.includes("reportDocumentTemplateLabel === 'Capacity Inventory Brief'") && expression.includes("selectedDimensions[0] === 'channelV2'") && expression.includes("selectedMeasures.length === 1") && expression.includes("selectedMeasures[0] === 'avails'") && expression.includes("chartSpec?.title === 'Inventory · Top Channels'") && expression.includes("chartSpec?.type === 'horizontal_bar'") && expression.includes("chartSpec?.xField === 'channelV2'") && expression.includes("chartSpec.yFields.length === 1") && expression.includes("chartSpec.yFields[0] === 'avails'") && expression.includes("!window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession") && expression.includes("binding?.mode === 'semantic'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Review export") || expression.includes("Inspect export")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export request summary") && expression.includes("reportPrint?.title === \"Capacity Inventory Top Channels Q3\"") && expression.includes("bookmark.primaryChart") && expression.includes("Inventory · Top Channels")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("JSON.stringify(signature) ===") && expression.includes("marginBottom") && expression.includes("scopeFilters__line_1") && expression.includes("Channels:") && expression.includes("primaryTable__row_1__channelV2__text") && expression.includes("Display") && expression.includes("primaryTable__row_2__avails__text") && expression.includes("138 200") && expression.includes("primaryChart__svg_page_1") && expression.includes("Inventory Outlook") && expression.includes("headlineKpi__value_0") && expression.includes("Avails: 158 400") && expression.includes("headlineKpi__detail_1") && expression.includes("Highlights the leading channel row before drilling") && expression.includes("headlineKpi__detail_2") && expression.includes("page_2__header_title") && expression.includes("page_2__footer_page_number") && expression.includes("Page 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === \"Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture?.payloadReady") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("reportPrint?.title === \"Capacity Inventory Top Channels Q3\"") && expression.includes("bookmark.primaryChart") && expression.includes("Inventory · Top Channels")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture?.payloadReady") && expression.includes("JSON.stringify(signature) ===") && expression.includes("marginBottom") && expression.includes("scopeFilters__line_1") && expression.includes("Channels:") && expression.includes("primaryTable__row_1__channelV2__text") && expression.includes("Display") && expression.includes("primaryTable__row_2__avails__text") && expression.includes("138 200") && expression.includes("primaryChart__svg_page_1") && expression.includes("Inventory Outlook") && expression.includes("headlineKpi__value_0") && expression.includes("Avails: 158 400") && expression.includes("headlineKpi__detail_1") && expression.includes("Highlights the leading channel row before drilling") && expression.includes("headlineKpi__detail_2") && expression.includes("page_2__header_title") && expression.includes("page_2__footer_page_number") && expression.includes("Page 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-capacity-inventory-template-export-geometry")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Inventory Top Channels Q3"));
const reopenedExportVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Review export") && String(step?.expression || "").includes("Inspect export"));
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened section."));
const genericSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened export request summary") && String(step?.expression || "").includes("reportPrint?.title === \"Capacity Inventory Top Channels Q3\""));
const geometrySummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("JSON.stringify(signature) ===") && String(step?.expression || "").includes("marginBottom") && String(step?.expression || "").includes("scopeFilters__line_1") && String(step?.expression || "").includes("Channels:") && String(step?.expression || "").includes("primaryTable__row_1__channelV2__text") && String(step?.expression || "").includes("Display") && String(step?.expression || "").includes("primaryTable__row_2__avails__text") && String(step?.expression || "").includes("138 200") && String(step?.expression || "").includes("primaryChart__svg_page_1") && String(step?.expression || "").includes("Inventory Outlook") && String(step?.expression || "").includes("headlineKpi__value_0") && String(step?.expression || "").includes("Avails: 158 400") && String(step?.expression || "").includes("headlineKpi__detail_1") && String(step?.expression || "").includes("Highlights the leading channel row before drilling") && String(step?.expression || "").includes("headlineKpi__detail_2") && String(step?.expression || "").includes("page_2__header_title") && String(step?.expression || "").includes("page_2__footer_page_number") && String(step?.expression || "").includes("Page 2"));
const downloadExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Download export request button not found."));
const downloadedReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === \"Capacity Inventory Top Channels Q3-savedPayload-pdf-export-request.json\""));
const genericDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture?.payloadReady") && String(step?.expression || "").includes("parsed?.kind === 'reportExportRequest'") && String(step?.expression || "").includes("bookmark.primaryChart"));
const geometryDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture?.payloadReady") && String(step?.expression || "").includes("JSON.stringify(signature) ===") && String(step?.expression || "").includes("marginBottom") && String(step?.expression || "").includes("scopeFilters__line_1") && String(step?.expression || "").includes("Channels:") && String(step?.expression || "").includes("primaryTable__row_1__channelV2__text") && String(step?.expression || "").includes("Display") && String(step?.expression || "").includes("primaryTable__row_2__avails__text") && String(step?.expression || "").includes("138 200") && String(step?.expression || "").includes("primaryChart__svg_page_1") && String(step?.expression || "").includes("Inventory Outlook") && String(step?.expression || "").includes("headlineKpi__value_0") && String(step?.expression || "").includes("Avails: 158 400") && String(step?.expression || "").includes("headlineKpi__detail_1") && String(step?.expression || "").includes("Highlights the leading channel row before drilling") && String(step?.expression || "").includes("headlineKpi__detail_2") && String(step?.expression || "").includes("page_2__header_title") && String(step?.expression || "").includes("page_2__footer_page_number") && String(step?.expression || "").includes("Page 2"));

assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenNoticeIndex, -1);
assert.notEqual(reopenedExportVisibleIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(genericSummaryIndex, -1);
assert.notEqual(geometrySummaryIndex, -1);
assert.notEqual(downloadExportIndex, -1);
assert.notEqual(downloadedReadyIndex, -1);
assert.notEqual(genericDownloadedIndex, -1);
assert.notEqual(geometryDownloadedIndex, -1);

assert.equal(selectedEntryIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenNoticeIndex, true);
assert.equal(reopenNoticeIndex < reopenedExportVisibleIndex, true);
assert.equal(reopenedExportVisibleIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < genericSummaryIndex, true);
assert.equal(genericSummaryIndex < geometrySummaryIndex, true);
assert.equal(geometrySummaryIndex < downloadExportIndex, true);
assert.equal(downloadExportIndex < downloadedReadyIndex, true);
assert.equal(downloadedReadyIndex < genericDownloadedIndex, true);
assert.equal(genericDownloadedIndex < geometryDownloadedIndex, true);

console.log("report-builder-preview-reopen-capacity-inventory-template-export-geometry-scenario-assets ✓ reopened capacity inventory template export stays inspectable and preserves expected report print geometry");
