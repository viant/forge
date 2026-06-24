import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-saved-view-live-export-request.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 18);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes('"from": "savedView"') && expression.includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Trend Q3 Saved View for editing.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Runtime Note") && expression.includes("Live selected entry export note.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes("Runtime Note") && expression.includes("Live selected entry export note.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-saved-view-live-export-request")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected list entry export request summary") && String(step?.expression || "").includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"'));
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const addRuntimeNoteIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Runtime Note") && String(step?.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const updatedExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Live selected entry export note."));

assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(addRuntimeNoteIndex, -1);
assert.notEqual(updatedExportSummaryIndex, -1);

assert.equal(selectedEntryIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < addRuntimeNoteIndex, true);
assert.equal(addRuntimeNoteIndex < updatedExportSummaryIndex, true);

console.log("report-builder-preview-list-entry-saved-view-live-export-request-scenario-assets ✓ selected saved-view list-entry export request updates to the live reopened builder state");
