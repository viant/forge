import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-missing-local-backing.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 14);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse") && expression.includes("title: \"Capacity External\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("no local backing")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Why export is unavailable"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected catalog entry export request summary") && expression.includes("no local backing")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get request"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Get ReportDocument request summary") && expression.includes("no local backing")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-missing-local-backing")),
  true,
);

const replacePreparedListIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replacePreparedListReportDocumentsResponse"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity External"));
const blockerChipIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("no local backing"));
const blockerButtonIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Why export is unavailable");
const exportPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected catalog entry export request summary"));
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const getInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Get ReportDocument request summary"));

assert.notEqual(replacePreparedListIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(blockerChipIndex, -1);
assert.notEqual(blockerButtonIndex, -1);
assert.notEqual(exportPanelIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(getInspectorIndex, -1);

assert.equal(replacePreparedListIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < blockerChipIndex, true);
assert.equal(blockerChipIndex < blockerButtonIndex, true);
assert.equal(blockerButtonIndex < exportPanelIndex, true);
assert.equal(exportPanelIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < getInspectorIndex, true);

console.log("report-builder-preview-selected-entry-missing-local-backing-scenario-assets ✓ source-less selected catalog entries without local reopen backing surface explicit export and reopen blockers in the live preview flow");
