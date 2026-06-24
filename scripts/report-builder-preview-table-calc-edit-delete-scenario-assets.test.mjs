import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-table-calc-edit-delete.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Preview patchBuilderState API not available.") && expression.includes("selectedDimensions: ['eventDate', 'channelV2']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyLocalTableCalculationDraft API not available.") && expression.includes("runningAvails") && expression.includes("Running Avails")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyLocalTableCalculationDraft API not available.") && expression.includes("Running Avails Edited")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeLocalTableCalculation API not available.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headers.includes('running avails edited')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!headers.includes('running avails edited')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state?.localTableCalculations") && expression.includes("runningAvails")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("table-calc-edit-delete")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add Table Calculation"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("[role=\"menuitem\"]")),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[name=\"tableCalcLabel\"]"),
  false,
);

const seedStateIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const addTableCalcIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyLocalTableCalculationDraft API not available.") && String(step.expression || "").includes("Running Avails"));
const firstLocalDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const editTableCalcIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyLocalTableCalculationDraft API not available.") && String(step.expression || "").includes("Running Avails Edited"));
const editedHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headers.includes('running avails edited')"));
const editedStorageIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.localTableCalculations") && String(step.expression || "").includes("Running Avails Edited"));
const removeTableCalcIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeLocalTableCalculation API not available."));
const removedHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!headers.includes('running avails edited')"));
const removedStorageIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!Array.isArray(parsed?.localTableCalculations) || !parsed.localTableCalculations.some((entry) => entry?.id === 'runningAvails')"));
const reloadIndex = findStepIndex((step, index) => index > removedStorageIndex && step?.type === "reload");
const reloadedDraftIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const reloadedStateIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("state?.localTableCalculations") && String(step.expression || "").includes("runningAvails"));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(addTableCalcIndex, -1);
assert.notEqual(firstLocalDraftIndex, -1);
assert.notEqual(editTableCalcIndex, -1);
assert.notEqual(editedHeaderIndex, -1);
assert.notEqual(editedStorageIndex, -1);
assert.notEqual(removeTableCalcIndex, -1);
assert.notEqual(removedHeaderIndex, -1);
assert.notEqual(removedStorageIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(reloadedDraftIndex, -1);
assert.notEqual(reloadedStateIndex, -1);

assert.equal(seedStateIndex < addTableCalcIndex, true);
assert.equal(addTableCalcIndex < firstLocalDraftIndex, true);
assert.equal(firstLocalDraftIndex < editTableCalcIndex, true);
assert.equal(editTableCalcIndex < editedHeaderIndex, true);
assert.equal(editedHeaderIndex < editedStorageIndex, true);
assert.equal(editedStorageIndex < removeTableCalcIndex, true);
assert.equal(removeTableCalcIndex < removedHeaderIndex, true);
assert.equal(removedHeaderIndex < removedStorageIndex, true);
assert.equal(removedStorageIndex < reloadIndex, true);
assert.equal(reloadIndex < reloadedDraftIndex, true);
assert.equal(reloadedDraftIndex < reloadedStateIndex, true);

console.log("report-builder-preview-table-calc-edit-delete-scenario-assets ✓ table calculations can be edited and deleted through preview helpers without regressing to the old manage-menu flow");
