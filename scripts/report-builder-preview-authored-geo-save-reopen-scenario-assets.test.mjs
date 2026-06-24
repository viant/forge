import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-geo-save-reopen.scenario.mjs";

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
  expressions.some((expression) => expression.includes(".forge-report-builder__document-block-card strong") && expression.includes("Market Geo")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare get response button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopen in builder button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("geoMapBlock")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("Market Geo") && expression.includes("2 Regions") && expression.includes("Total Avails: 2,180,000") && expression.includes("CA") && expression.includes("WA")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"geoMapBlock\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Market Geo\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"shape\": \"us-states\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"kind\": \"geoMapBlock\"") && expression.includes("\"title\": \"Market Geo\"") && expression.includes("\"shape\": \"us-states\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some") && expression.includes("Market Geo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Report Builder Demo for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-geo-save-reopen")),
  true,
);

const pivotIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const addGeoIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("geoMapBlock"));
const addGeoCardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__document-block-card strong") && String(step.expression || "").includes("Market Geo"));
const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview replaceCollectionRows API not available."));
const previewGeoIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Total Avails: 2,180,000"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetPayloadIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"kind\": \"geoMapBlock\""));
const removeGeoIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available."));
const removedGeoCardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some") && String(step.expression || "").includes("Market Geo"));
const reopenIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));

assert.notEqual(pivotIndex, -1);
assert.notEqual(addGeoIndex, -1);
assert.notEqual(addGeoCardIndex, -1);
assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(previewGeoIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetPayloadIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeGeoIndex, -1);
assert.notEqual(removedGeoCardIndex, -1);
assert.notEqual(reopenIndex, -1);

assert.equal(pivotIndex < addGeoIndex, true);
assert.equal(addGeoIndex < addGeoCardIndex, true);
assert.equal(addGeoCardIndex < replaceRowsIndex, true);
assert.equal(replaceRowsIndex < previewGeoIndex, true);
assert.equal(previewGeoIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetPayloadIndex, true);
assert.equal(hiddenGetPayloadIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeGeoIndex, true);
assert.equal(removeGeoIndex < removedGeoCardIndex, true);
assert.equal(removedGeoCardIndex < reopenIndex, true);

const reopenedGeoStep = scenario.steps
  .slice(reopenIndex + 1)
  .find((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Total Avails: 2,180,000"));

assert.notEqual(reopenedGeoStep, undefined);

console.log("report-builder-preview-authored-geo-save-reopen-scenario-assets ✓ authored geo block survives save/get/reopen with geo payload and rendered region summary");
