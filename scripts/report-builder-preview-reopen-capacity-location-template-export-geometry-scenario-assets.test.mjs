import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-capacity-location-template-export-geometry.scenario.mjs";

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

assert.equal(
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTemplateId === 'capacity_location_brief'") && expression.includes("reportDocumentTemplateLabel === 'Capacity Location Brief'") && expression.includes("chartSpec?.title === 'Locations · Top Markets'") && expression.includes("selectedDimensions[0] === 'country'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Review export") || expression.includes("Inspect export")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export request summary") && expression.includes("reportPrint?.title === \"Capacity Locations Top Markets Q3\"") && expression.includes("bookmark.primaryChart") && expression.includes("Locations · Top Markets")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("pageGeometry?.width === 792") && expression.includes("pageGeometry?.height === 612") && expression.includes("pages.length === 2") && expression.includes("diagnostics.length === 0") && expression.includes("scope?.box?.x === 36") && expression.includes("scope?.box?.y === 84") && expression.includes("table?.box?.x === 36") && expression.includes("table?.box?.y === 140") && expression.includes("chart?.box?.x === 36") && expression.includes("chart?.box?.y === 252") && expression.includes("narrative?.box?.x === 36") && expression.includes("narrative?.box?.y === 456") && expression.includes("narrative?.box?.width === 348") && expression.includes("kpi?.box?.x === 408") && expression.includes("kpi?.box?.y === 456") && expression.includes("kpi?.box?.width === 348")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === \"Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture?.payloadReady") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("reportPrint?.title === \"Capacity Locations Top Markets Q3\"") && expression.includes("bookmark.primaryChart") && expression.includes("Locations · Top Markets")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportPrint?.pageGeometry?.width === 792") && expression.includes("reportPrint?.pageGeometry?.height === 612") && expression.includes("pages.length === 2") && expression.includes("diagnostics.length === 0") && expression.includes("scope?.box?.x === 36") && expression.includes("scope?.box?.y === 84") && expression.includes("table?.box?.x === 36") && expression.includes("table?.box?.y === 140") && expression.includes("chart?.box?.x === 36") && expression.includes("chart?.box?.y === 252") && expression.includes("narrative?.box?.x === 36") && expression.includes("narrative?.box?.y === 456") && expression.includes("narrative?.box?.width === 348") && expression.includes("kpi?.box?.x === 408") && expression.includes("kpi?.box?.y === 456") && expression.includes("kpi?.box?.width === 348")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Locations Top Markets Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Locations Top Markets Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-capacity-location-template-export-geometry")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Locations Top Markets Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Locations Top Markets Q3"));
const reopenedExportVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Review export") && String(step?.expression || "").includes("Inspect export"));
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened section."));
const genericSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened export request summary") && String(step?.expression || "").includes("reportPrint?.title === \"Capacity Locations Top Markets Q3\""));
const geometrySummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("pageGeometry?.width === 792") && String(step?.expression || "").includes("pageGeometry?.height === 612") && String(step?.expression || "").includes("pages.length === 2") && String(step?.expression || "").includes("diagnostics.length === 0") && String(step?.expression || "").includes("scope?.box?.x === 36") && String(step?.expression || "").includes("scope?.box?.y === 84") && String(step?.expression || "").includes("table?.box?.x === 36") && String(step?.expression || "").includes("table?.box?.y === 140") && String(step?.expression || "").includes("chart?.box?.x === 36") && String(step?.expression || "").includes("chart?.box?.y === 252") && String(step?.expression || "").includes("narrative?.box?.x === 36") && String(step?.expression || "").includes("narrative?.box?.y === 456") && String(step?.expression || "").includes("narrative?.box?.width === 348") && String(step?.expression || "").includes("kpi?.box?.x === 408") && String(step?.expression || "").includes("kpi?.box?.y === 456") && String(step?.expression || "").includes("kpi?.box?.width === 348"));
const downloadExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Download export request button not found."));
const downloadedReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === \"Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json\""));
const genericDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture?.payloadReady") && String(step?.expression || "").includes("parsed?.kind === 'reportExportRequest'") && String(step?.expression || "").includes("bookmark.primaryChart"));
const geometryDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("reportPrint?.pageGeometry?.width === 792") && String(step?.expression || "").includes("reportPrint?.pageGeometry?.height === 612") && String(step?.expression || "").includes("pages.length === 2") && String(step?.expression || "").includes("diagnostics.length === 0") && String(step?.expression || "").includes("scope?.box?.x === 36") && String(step?.expression || "").includes("scope?.box?.y === 84") && String(step?.expression || "").includes("table?.box?.x === 36") && String(step?.expression || "").includes("table?.box?.y === 140") && String(step?.expression || "").includes("chart?.box?.x === 36") && String(step?.expression || "").includes("chart?.box?.y === 252") && String(step?.expression || "").includes("narrative?.box?.x === 36") && String(step?.expression || "").includes("narrative?.box?.y === 456") && String(step?.expression || "").includes("narrative?.box?.width === 348") && String(step?.expression || "").includes("kpi?.box?.x === 408") && String(step?.expression || "").includes("kpi?.box?.y === 456") && String(step?.expression || "").includes("kpi?.box?.width === 348"));

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

console.log("report-builder-preview-reopen-capacity-location-template-export-geometry-scenario-assets ✓ reopened capacity location template export stays inspectable and preserves expected report print geometry");
