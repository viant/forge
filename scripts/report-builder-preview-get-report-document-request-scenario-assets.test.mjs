import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-get-report-document-request.scenario.mjs";

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
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Q3-get-report-document-request.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentRequest\"')") && expression.includes("window.__artifactDownloadCapture.payload.includes('\"reportId\": \"capacityQ3\"')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get request"),
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
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentRequest\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityQ3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("get-report-document-request")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save report file"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const selectEntryIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.selector === "select[aria-label=\"List response entry\"]" && step?.value === "capacityQ3");
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3"));
const prepareRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const requestHiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const inspectRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const requestVisibleAfterInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const downloadRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download get request");
const downloadedRequestIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Capacity Q3-get-report-document-request.json"));
const hideRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide get request");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideRequestIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(selectEntryIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(prepareRequestIndex, -1);
assert.notEqual(requestHiddenBeforeInspectIndex, -1);
assert.notEqual(inspectRequestIndex, -1);
assert.notEqual(requestVisibleAfterInspectIndex, -1);
assert.notEqual(downloadRequestIndex, -1);
assert.notEqual(downloadedRequestIndex, -1);
assert.notEqual(hideRequestIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareListIndex, true);
assert.equal(prepareListIndex < selectEntryIndex, true);
assert.equal(selectEntryIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < prepareRequestIndex, true);
assert.equal(prepareRequestIndex < requestHiddenBeforeInspectIndex, true);
assert.equal(requestHiddenBeforeInspectIndex < inspectRequestIndex, true);
assert.equal(inspectRequestIndex < requestVisibleAfterInspectIndex, true);
assert.equal(requestVisibleAfterInspectIndex < downloadRequestIndex, true);
assert.equal(downloadRequestIndex < downloadedRequestIndex, true);
assert.equal(downloadedRequestIndex < hideRequestIndex, true);
assert.equal(hideRequestIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-get-report-document-request-scenario-assets ✓ get request follows the current saved payload/list-entry flow and preserves request inspector/download behavior");
