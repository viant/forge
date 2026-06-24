import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-blocks-invalid-compile-state.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 30);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findAllStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock") && expression.includes("kpiBlock") && expression.includes("Reach KPI")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Available Impressions toggle not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare create payload") && expression.includes("button.disabled === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare update payload") && expression.includes("button.disabled === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolve authored block validation issues before preparing writable ReportDocument payloads.")),
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
  scenario.steps.filter((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Headline KPI references unavailable KPI value field 'avails'." )).length >= 4,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Open selected response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Edit authored block headlineKpi"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-blocks-invalid-compile-state")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare create payload"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare update payload"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload:")),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update ReportDocument payload:")),
  false,
);

const addKpiIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("applyAuthoredDocumentBlock") && String(step?.expression || "").includes("Reach KPI"));
const toggleMeasureIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Available Impressions toggle not found."));
const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const firstWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolve authored block validation issues before preparing writable ReportDocument payloads."));
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const selectEntryIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.selector === "select[aria-label=\"List response entry\"]" && step?.value === "demoReportBuilder");
const selectedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry compile warning:"));
const expectedVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && step?.selector === "input[aria-label=\"Expected version\"]");
const createDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Prepare create payload") && String(step?.expression || "").includes("button.disabled === true"));
const updateDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Prepare update payload") && String(step?.expression || "").includes("button.disabled === true"));
const prepareRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const persistedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Persisted compile warning:"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedWarningIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile warning:"));
const editBlockIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Edit authored block headlineKpi");

assert.notEqual(addKpiIndex, -1);
assert.notEqual(toggleMeasureIndex, -1);
assert.notEqual(beginDraftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(firstWarningIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(selectEntryIndex, -1);
assert.notEqual(selectedWarningIndex, -1);
assert.notEqual(expectedVersionIndex, -1);
assert.notEqual(createDisabledIndex, -1);
assert.notEqual(updateDisabledIndex, -1);
assert.notEqual(prepareRequestIndex, -1);
assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(persistedWarningIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedWarningIndex, -1);
assert.notEqual(editBlockIndex, -1);

assert.equal(addKpiIndex < toggleMeasureIndex, true);
assert.equal(toggleMeasureIndex < beginDraftIndex, true);
assert.equal(beginDraftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < firstWarningIndex, true);
assert.equal(firstWarningIndex < prepareListIndex, true);
assert.equal(prepareListIndex < selectEntryIndex, true);
assert.equal(selectEntryIndex < selectedWarningIndex, true);
assert.equal(selectedWarningIndex < expectedVersionIndex, true);
assert.equal(expectedVersionIndex < createDisabledIndex, true);
assert.equal(createDisabledIndex < updateDisabledIndex, true);
assert.equal(updateDisabledIndex < prepareRequestIndex, true);
assert.equal(prepareRequestIndex < openSelectedResponseIndex, true);
assert.equal(openSelectedResponseIndex < persistedWarningIndex, true);
assert.equal(persistedWarningIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedWarningIndex, true);
assert.equal(reopenedWarningIndex < editBlockIndex, true);

console.log("report-builder-preview-authored-blocks-invalid-compile-state-scenario-assets ✓ authored KPI compile failures block writable payloads while preserving diagnostics through saved-response reopen");
