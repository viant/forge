import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-edit-preserve-mappings.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("channel-detail-modal") && expression.includes("source: 'archived'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Route preset select not found")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state.drillMetadata.detailTargets.length === 2") && expression.includes("state.drillMetadata.fieldActions.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("detailTarget.parameters?.source === 'archived'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes("text.includes('archived')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("detail-target-edit-preserve-mappings")),
  true,
);

const seedStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState"));
const selectPresetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Route preset select not found"));
const verifyPresetHydrationIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("targetInput.value === 'target://example/performance/channel-detail-modal'"));
const verifyPersistedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.source === 'archived'"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes('target://example/performance/channel-detail-modal')") && String(step?.expression || "").includes("text.includes('archived')"));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(verifyPresetHydrationIndex, -1);
assert.notEqual(verifyPersistedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(seedStateIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < verifyPresetHydrationIndex, true);
assert.equal(verifyPresetHydrationIndex < verifyPersistedStateIndex, true);
assert.equal(verifyPersistedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-edit-preserve-mappings-scenario-assets ✓ preview scenario covers detail-target editing, rebinding, and preserved runtime mappings");
