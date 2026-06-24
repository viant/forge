import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-export-request.scenario.mjs";

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
  expressions.some((expression) => expression.includes("chartSpec?.title === 'Locations · Top Markets'") && expression.includes("selectedDimensions[0] === 'country'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Runtime Note") && expression.includes("Live reopened export note.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Review export") || expression.includes("Inspect export")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export request summary") && expression.includes("reportPrint") && expression.includes("Capacity Locations Top Markets Q3") && expression.includes("Runtime Note")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes("\"from\": \"savedPayload\"") && expression.includes("\"payloadId\": \"rbreport_capacity_q3_locations_top_markets\"") && expression.includes("Runtime Note")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === \"Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("reportPrint?.kind === 'reportPrint'") && expression.includes("bookmark.primaryChart") && expression.includes("Runtime Note")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture?.payloadReady") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("reportPrint?.kind === 'reportPrint'") && expression.includes("bookmark.primaryChart") && expression.includes("Runtime Note")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-export-request")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Locations Top Markets Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const addRuntimeNoteIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Runtime Note") && String(step?.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const reopenedExportVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Review export") && String(step?.expression || "").includes("Inspect export"));
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened section."));
const exportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened export request summary") && String(step?.expression || "").includes("reportPrint"));
const downloadExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Download export request button not found."));
const downloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === \"Capacity Locations Top Markets Q3-savedPayload-pdf-export-request.json\""));
const inspectSelectedListEntryExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export"));
const selectedListEntryExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected list entry export request summary") && String(step?.expression || "").includes("\"payloadId\": \"rbreport_capacity_q3_locations_top_markets\""));

assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(addRuntimeNoteIndex, -1);
assert.notEqual(reopenedExportVisibleIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(exportSummaryIndex, -1);
assert.notEqual(downloadExportIndex, -1);
assert.notEqual(downloadedIndex, -1);
assert.notEqual(inspectSelectedListEntryExportIndex, -1);
assert.notEqual(selectedListEntryExportSummaryIndex, -1);

assert.equal(selectedEntryIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < addRuntimeNoteIndex, true);
assert.equal(addRuntimeNoteIndex < reopenedExportVisibleIndex, true);
assert.equal(reopenedExportVisibleIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < exportSummaryIndex, true);
assert.equal(exportSummaryIndex < downloadExportIndex, true);
assert.equal(downloadExportIndex < downloadedIndex, true);
assert.equal(downloadedIndex < inspectSelectedListEntryExportIndex, true);
assert.equal(inspectSelectedListEntryExportIndex < selectedListEntryExportSummaryIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-export-request-scenario-assets ✓ reopened semantic chart export request remains inspectable and downloadable with semantic report print metadata");
