import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-table-calc-authoring.scenario.mjs";

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

assert.equal(
  expressions.some((expression) => expression.includes("Preview patchBuilderState API not available.") && expression.includes("selectedDimensions: ['eventDate', 'channelV2']") && expression.includes("viewMode: 'table'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyLocalCalculatedField API not available.") && expression.includes("ctvAvails") && expression.includes("if(channelV2 = 'CTV', avails, null)")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyLocalTableCalculationDraft API not available.") && expression.includes("runningCtvAvails") && expression.includes("sourceField: 'ctvAvails'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"id\": \"runningCtvAvails\"") && expression.includes("\"sourceField\": \"ctvAvails\"")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("state?.localTableCalculations") && expression.includes("runningCtvAvails")).length >= 2,
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("Running CTV Avails") && expression.includes("70,300") && expression.includes("CTV Avails") && expression.includes("34,300")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"localTableCalculations\": [")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"id\": \"runningCtvAvails\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"sourceField\": \"ctvAvails\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("table-calc-authoring")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add calculated"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add Table Calculation"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[name=\"tableCalcId\"]"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select[name=\"tableCalcFunction\"]"),
  false,
);

const seedStateIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const applyCalcIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyLocalCalculatedField API not available."));
const firstLocalDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const applyTableCalcIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyLocalTableCalculationDraft API not available."));
const localTableCalcStorageIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.localStorage.getItem") && String(step.expression || "").includes("runningCtvAvails"));
const firstHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headers.includes('running ctv avails')") && String(step.expression || "").includes("headers.includes('ctv avails')"));
const firstRuntimeValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Running CTV Avails") && String(step.expression || "").includes("70,300"));
const reloadIndex = findStepIndex((step, index) => index > firstRuntimeValueIndex && step?.type === "reload");
const reloadedLocalDraftIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const reloadedTableCalcStateIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("state?.localTableCalculations") && String(step.expression || "").includes("runningCtvAvails"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const localTableCalcPayloadIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"localTableCalculations\": ["));
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const prepareRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"id\": \"runningCtvAvails\""));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedRuntimeIndex = findStepIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes("Running CTV Avails") && String(step.expression || "").includes("70,300"));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(applyCalcIndex, -1);
assert.notEqual(firstLocalDraftIndex, -1);
assert.notEqual(applyTableCalcIndex, -1);
assert.notEqual(localTableCalcStorageIndex, -1);
assert.notEqual(firstHeaderIndex, -1);
assert.notEqual(firstRuntimeValueIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(reloadedLocalDraftIndex, -1);
assert.notEqual(reloadedTableCalcStateIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(localTableCalcPayloadIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(prepareRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(inspectPayloadIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedRuntimeIndex, -1);

assert.equal(seedStateIndex < applyCalcIndex, true);
assert.equal(applyCalcIndex < firstLocalDraftIndex, true);
assert.equal(firstLocalDraftIndex < applyTableCalcIndex, true);
assert.equal(applyTableCalcIndex < localTableCalcStorageIndex, true);
assert.equal(localTableCalcStorageIndex < firstHeaderIndex, true);
assert.equal(firstHeaderIndex < firstRuntimeValueIndex, true);
assert.equal(firstRuntimeValueIndex < reloadIndex, true);
assert.equal(reloadIndex < reloadedLocalDraftIndex, true);
assert.equal(reloadedLocalDraftIndex < reloadedTableCalcStateIndex, true);
assert.equal(reloadedTableCalcStateIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < localTableCalcPayloadIndex, true);
assert.equal(localTableCalcPayloadIndex < prepareListIndex, true);
assert.equal(prepareListIndex < prepareRequestIndex, true);
assert.equal(prepareRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < inspectPayloadIndex, true);
assert.equal(inspectPayloadIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedRuntimeIndex, true);

console.log("report-builder-preview-table-calc-authoring-scenario-assets ✓ table calculations depending on local calculated fields persist through reload, saved payload, selected get response, and reopen without relying on modal UI flow");
