import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-invalid-get-report-document-table-response.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("appendSeededSavedReportPayloadRecord") && expression.includes("marketEfficiencyBriefQ3") && expression.includes("patchSeededSavedReportPayload")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("marketEfficiencyBriefQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Market Efficiency Brief Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry compile warning:")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Persisted compile warning:")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened compile warning:")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Rate Table references unavailable table column 'reachRate'.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Open selected response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Edit authored block reachRateTable"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-invalid-get-report-document-table-response")),
  true,
);

const patchInvalidIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("appendSeededSavedReportPayloadRecord"));
const prepareListResponseIndexes = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const firstPrepareListResponseIndex = prepareListResponseIndexes[0] ?? -1;
const secondPrepareListResponseIndex = prepareListResponseIndexes[1] ?? -1;
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Market Efficiency Brief Q3"));
const selectedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry compile warning:"));
const inspectRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const persistedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Persisted compile warning:"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile warning:"));
const editBlockIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Edit authored block reachRateTable");

assert.notEqual(patchInvalidIndex, -1);
assert.equal(prepareListResponseIndexes.length, 2);
assert.notEqual(firstPrepareListResponseIndex, -1);
assert.notEqual(secondPrepareListResponseIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(selectedWarningIndex, -1);
assert.notEqual(inspectRequestIndex, -1);
assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(persistedWarningIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedWarningIndex, -1);
assert.notEqual(editBlockIndex, -1);

assert.equal(firstPrepareListResponseIndex < patchInvalidIndex, true);
assert.equal(patchInvalidIndex < secondPrepareListResponseIndex, true);
assert.equal(secondPrepareListResponseIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < selectedWarningIndex, true);
assert.equal(selectedWarningIndex < inspectRequestIndex, true);
assert.equal(inspectRequestIndex < openSelectedResponseIndex, true);
assert.equal(openSelectedResponseIndex < persistedWarningIndex, true);
assert.equal(persistedWarningIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedWarningIndex, true);
assert.equal(reopenedWarningIndex < editBlockIndex, true);

console.log("report-builder-preview-selected-invalid-get-report-document-table-response-scenario-assets ✓ selected invalid table response preserves compile warnings through local response open and reopen");
