import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-calculated-field-authoring.scenario.mjs";

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

assert.equal(
  expressions.some((expression) => expression.includes("Preview patchBuilderState API not available.") && expression.includes("selectedDimensions: ['eventDate', 'channelV2']") && expression.includes("viewMode: 'table'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyLocalCalculatedField API not available.") && expression.includes("ctvAvails") && expression.includes("if(channelV2 = 'CTV', avails, null)")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state?.localCalculatedFields") && expression.includes("ctvAvails")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Get ReportDocument response summary") && expression.includes("\"id\": \"ctvAvails\"") && expression.includes("if(channelV2 = \\'CTV\\', avails, null)")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("headers.includes('ctv avails')")).length >= 3,
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("CTV Avails") && expression.includes("34,300")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"localCalculatedFields\": [")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"id\": \"ctvAvails\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"expr\": \"if(channelV2 = 'CTV', avails, null)\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("calculated-field-authoring")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add calculated"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[placeholder=\"projectedLift\"]"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[placeholder=\"Projected Lift\"]"),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step?.selector || "").includes("textarea[placeholder*=\"if(impressions = 0\"]")),
  false,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add Field"),
  false,
);

const seedStateIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Preview patchBuilderState API not available."));
const applyCalculatedFieldIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyLocalCalculatedField API not available."));
const firstMeasurePillIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__measure-pill") && String(step.expression || "").includes("CTV Avails"));
const firstLocalDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const localStorageIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.localStorage.getItem") && String(step.expression || "").includes("ctvAvails"));
const firstHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headers.includes('ctv avails')"));
const firstRuntimeValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-table-panel") && String(step.expression || "").includes("34,300"));
const reloadIndex = findStepIndex((step, index) => index > firstRuntimeValueIndex && step?.type === "reload");
const reloadedStateIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("state?.localCalculatedFields") && String(step.expression || "").includes("ctvAvails"));
const reloadedLocalDraftIndex = findStepIndex((step, index) => index > reloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const localCalcPayloadIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"localCalculatedFields\": ["));
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const prepareRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectResponsePayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"id\": \"ctvAvails\""));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedStateIndex = findStepIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes("state?.localCalculatedFields") && String(step.expression || "").includes("ctvAvails"));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(applyCalculatedFieldIndex, -1);
assert.notEqual(firstMeasurePillIndex, -1);
assert.notEqual(firstLocalDraftIndex, -1);
assert.notEqual(localStorageIndex, -1);
assert.notEqual(firstHeaderIndex, -1);
assert.notEqual(firstRuntimeValueIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(reloadedStateIndex, -1);
assert.notEqual(reloadedLocalDraftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(localCalcPayloadIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(prepareRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(inspectResponsePayloadIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedStateIndex, -1);

assert.equal(seedStateIndex < applyCalculatedFieldIndex, true);
assert.equal(applyCalculatedFieldIndex < firstMeasurePillIndex, true);
assert.equal(firstMeasurePillIndex < firstLocalDraftIndex, true);
assert.equal(firstLocalDraftIndex < localStorageIndex, true);
assert.equal(localStorageIndex < firstHeaderIndex, true);
assert.equal(firstHeaderIndex < firstRuntimeValueIndex, true);
assert.equal(firstRuntimeValueIndex < reloadIndex, true);
assert.equal(reloadIndex < reloadedStateIndex, true);
assert.equal(reloadedStateIndex < reloadedLocalDraftIndex, true);
assert.equal(reloadedLocalDraftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < localCalcPayloadIndex, true);
assert.equal(localCalcPayloadIndex < prepareListIndex, true);
assert.equal(prepareListIndex < prepareRequestIndex, true);
assert.equal(prepareRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < inspectResponsePayloadIndex, true);
assert.equal(inspectResponsePayloadIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedStateIndex, true);

console.log("report-builder-preview-calculated-field-authoring-scenario-assets ✓ local calculated fields persist through preview reload, saved payload, selected get response, and reopen without relying on the modal UI flow");
