import assert from "node:assert/strict";

import scenario from "../../../tests/report-builder-preview-semantic-detail-target-edit-preserve-mappings.scenario.mjs";

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
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes("detailTarget.parameters?.source === 'archived'")),
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
const editBindingIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Detail action edit button not found"));
const selectPresetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Route preset select not found"));
const verifyPresetHydrationIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("targetInput.value === 'target://example/performance/channel-detail-modal'"));
const applyIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Detail target apply button not found"));
const verifyBuilderStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.source === 'archived'"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes('target://example/performance/channel-detail-modal')") && String(step?.expression || "").includes("text.includes('archived')"));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(editBindingIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(verifyPresetHydrationIndex, -1);
assert.notEqual(applyIndex, -1);
assert.notEqual(verifyBuilderStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(seedStateIndex < editBindingIndex, true);
assert.equal(editBindingIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < verifyPresetHydrationIndex, true);
assert.equal(verifyPresetHydrationIndex < applyIndex, true);
assert.equal(applyIndex < verifyBuilderStateIndex, true);
assert.equal(verifyBuilderStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("reportBuilderDetailTargetScenarioCoverage ✓ preview scenario covers detail-target preset editing and preserved runtime mappings");
