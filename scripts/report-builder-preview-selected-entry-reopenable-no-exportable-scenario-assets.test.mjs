import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-reopenable-no-exportable.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSeededSavedReportPayloads") && expression.includes("saved_view_capacity_imported")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse") && expression.includes("title: \"Capacity Imported\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("reopen-ready")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Why export is unavailable"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected catalog entry export request summary") && expression.includes("matching export-ready artifact first")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Imported")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-reopenable-no-exportable")),
  true,
);

const replaceSeededIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceSeededSavedReportPayloads"));
const replacePreparedListIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replacePreparedListReportDocumentsResponse"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Imported"));
const blockerButtonIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Why export is unavailable");
const exportPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected catalog entry export request summary"));
const prepareSelectedIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const getResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Imported"));

assert.notEqual(replaceSeededIndex, -1);
assert.notEqual(replacePreparedListIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(blockerButtonIndex, -1);
assert.notEqual(exportPanelIndex, -1);
assert.notEqual(prepareSelectedIndex, -1);
assert.notEqual(getResponseIndex, -1);

assert.equal(replaceSeededIndex < replacePreparedListIndex, true);
assert.equal(replacePreparedListIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < blockerButtonIndex, true);
assert.equal(blockerButtonIndex < exportPanelIndex, true);
assert.equal(exportPanelIndex < prepareSelectedIndex, true);
assert.equal(prepareSelectedIndex < getResponseIndex, true);

console.log("report-builder-preview-selected-entry-reopenable-no-exportable-scenario-assets ✓ selected catalog entries with local reopen backing but no export-ready artifact surface explicit export blockers while keeping local reopen available");
