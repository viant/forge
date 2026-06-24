import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-action-provider-retry.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("Avails by Date") && expression.includes("selectedDimensions: ['eventDate']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceRuntimeActionBehaviors") && expression.includes("Preview runtime action provider failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Failed to load refinement actions for Delivery Date.") && expression.includes("Preview runtime action provider failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceRuntimeActionBehaviors") && expression.includes("detail_date") && expression.includes("Show date details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Retry action provider")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Retrying action provider")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes('Preview runtime action provider failed.')") && expression.includes("!text.includes('Failed to load refinement actions for Delivery Date.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected value: 2026-05-01") && expression.includes("Show date details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-action-provider-retry")),
  true,
);

const patchStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState"));
const replaceFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Preview runtime action provider failed."));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run");
const diagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const retryVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Retry action provider"));
const replaceSuccessIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail_date") && String(step?.expression || "").includes("Show date details"));
const retryClickIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry action provider");
const staleErrorClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Preview runtime action provider failed.')") && String(step?.expression || "").includes("!text.includes('Failed to load refinement actions for Delivery Date.')"));
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected value: 2026-05-01"));

assert.notEqual(patchStateIndex, -1);
assert.notEqual(replaceFailureIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(diagnosticsIndex, -1);
assert.notEqual(retryVisibleIndex, -1);
assert.notEqual(replaceSuccessIndex, -1);
assert.notEqual(retryClickIndex, -1);
assert.notEqual(staleErrorClearedIndex, -1);
assert.notEqual(selectedValueIndex, -1);

assert.equal(patchStateIndex < replaceFailureIndex, true);
assert.equal(replaceFailureIndex < firstRunIndex, true);
assert.equal(firstRunIndex < diagnosticsIndex, true);
assert.equal(diagnosticsIndex < retryVisibleIndex, true);
assert.equal(retryVisibleIndex < replaceSuccessIndex, true);
assert.equal(replaceSuccessIndex < retryClickIndex, true);
assert.equal(retryClickIndex < staleErrorClearedIndex, true);
assert.equal(staleErrorClearedIndex < selectedValueIndex, true);
assert.equal(retryClickIndex < selectedValueIndex, true);

console.log("report-builder-preview-runtime-action-provider-retry-scenario-assets ✓ runtime action provider failure recovers and restores date detail actions");
