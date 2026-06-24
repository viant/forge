import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-response-download-metadata.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("Household Uniques measure button not found.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select[aria-label=\"List response entry\"]" && step?.value === "capacityQ3"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Q3-listReportDocumentsResponse.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"listReportDocumentsResponse\"')") && expression.includes("window.__artifactDownloadCapture.payload.includes('\"reportId\": \"capacityQ3\"')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("listReportDocumentsResponse")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download list response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-response-download-metadata")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect list response"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const hiddenBeforeSelectionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')"));
const selectEntryIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "capacityQ3");
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3"));
const downloadListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download list response");
const downloadedListIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Capacity Q3-listReportDocumentsResponse.json"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(hiddenBeforeSelectionIndex, -1);
assert.notEqual(selectEntryIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(downloadListIndex, -1);
assert.notEqual(downloadedListIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareListIndex, true);
assert.equal(prepareListIndex < hiddenBeforeSelectionIndex, true);
assert.equal(hiddenBeforeSelectionIndex < selectEntryIndex, true);
assert.equal(selectEntryIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < downloadListIndex, true);
assert.equal(downloadListIndex < downloadedListIndex, true);

console.log("report-builder-preview-list-response-download-metadata-scenario-assets ✓ list response download metadata follows the current saved payload flow and preserves the selected-entry download contract");
