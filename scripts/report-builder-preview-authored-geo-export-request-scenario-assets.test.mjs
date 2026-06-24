import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-geo-export-request.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Preview patchBuilderState API not available.") && expression.includes("selectedDimensions: ['country']") && expression.includes("selectedMeasures: ['avails']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("geoMapBlock") && expression.includes("Market Geo")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Preview replaceCollectionRows API not available.") && expression.includes("country: 'CA'") && expression.includes("country: 'WA'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("parsed?.target?.format === 'pdf'") && expression.includes("Top Regions")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Download export request button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo-savedPayload-pdf-export-request.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("mimeType?.includes('application/json')") && expression.includes("Total Available Impressions: 2,180,000") && expression.includes("Top: CA")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("Market Geo") && expression.includes("2 Regions") && expression.includes("Total Avails: 2,180,000") && expression.includes("CA") && expression.includes("WA")).length >= 1,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"geoMapBlock\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"shape\": \"us-states\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected measures (1)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Available Impressions")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-geo-export-request")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add geo"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[placeholder=\"Geo Map\"]"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add Block"),
  false,
);

const pivotIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const addGeoIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const addGeoCardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__document-block-card strong") && String(step.expression || "").includes("Market Geo"));
const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview replaceCollectionRows API not available."));
const previewGeoIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Total Avails: 2,180,000"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inspect export button not found for saved report payload."));
const savedExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary") && String(step.expression || "").includes("parsed?.kind === 'reportExportRequest'"));
const downloadExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Download export request button not found."));
const downloadReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Report Builder Demo-savedPayload-pdf-export-request.json"));
const downloadPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("mimeType?.includes('application/json')") && String(step.expression || "").includes("Total Available Impressions: 2,180,000") && String(step.expression || "").includes("Top: CA"));

assert.notEqual(pivotIndex, -1);
assert.notEqual(addGeoIndex, -1);
assert.notEqual(addGeoCardIndex, -1);
assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(previewGeoIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(savedExportSummaryIndex, -1);
assert.notEqual(downloadExportIndex, -1);
assert.notEqual(downloadReadyIndex, -1);
assert.notEqual(downloadPayloadIndex, -1);

assert.equal(pivotIndex < addGeoIndex, true);
assert.equal(addGeoIndex < addGeoCardIndex, true);
assert.equal(addGeoCardIndex < replaceRowsIndex, true);
assert.equal(replaceRowsIndex < previewGeoIndex, true);
assert.equal(previewGeoIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < savedExportSummaryIndex, true);
assert.equal(savedExportSummaryIndex < downloadExportIndex, true);
assert.equal(downloadExportIndex < downloadReadyIndex, true);
assert.equal(downloadReadyIndex < downloadPayloadIndex, true);

console.log("report-builder-preview-authored-geo-export-request-scenario-assets ✓ authored geo saved-payload export preserves semantic summary, geo print content, and downloadable PDF handoff payload");
