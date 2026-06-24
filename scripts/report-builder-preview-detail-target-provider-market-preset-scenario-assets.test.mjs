import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-market-preset.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] }")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Breakdown field select not found")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Route preset select not found")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/market-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titleInput.value === 'Show market details'") && expression.includes("parameterLabels.some")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("detailTarget.parameters?.country === '$value'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parameterCount === 1") && expression.includes("text.includes('US')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show market details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-market-preset")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig"));
const patchStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState"));
const selectFieldIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Breakdown field select not found"));
const selectPresetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Route preset select not found"));
const verifyProviderHydrationIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("titleInput.value === 'Show market details'"));
const verifyPersistedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.country === '$value'"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show market details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("parameterCount === 1") && String(step?.expression || "").includes("text.includes('US')"));

assert.notEqual(patchConfigIndex, -1);
assert.notEqual(patchStateIndex, -1);
assert.notEqual(selectFieldIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(verifyProviderHydrationIndex, -1);
assert.notEqual(verifyPersistedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(patchConfigIndex < patchStateIndex, true);
assert.equal(patchStateIndex < selectFieldIndex, true);
assert.equal(selectFieldIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < verifyProviderHydrationIndex, true);
assert.equal(verifyProviderHydrationIndex < verifyPersistedStateIndex, true);
assert.equal(verifyPersistedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-provider-market-preset-scenario-assets ✓ provider-backed market detail presets work in a fresh semantic builder flow");
