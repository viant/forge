import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-preset.scenario.mjs";

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
  expressions.some((expression) => expression.includes("config.drillMetadata.detailTargets.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state.drillMetadata?.detailTargets") && expression.includes("length === 0")),
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
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titleInput.value === 'Show channel details'") && expression.includes("parameterValues.includes('campaign')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("detailTarget.parameters?.campaign === '$row.campaign'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Detail target apply button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Prospect Sprint')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("detail-target-provider-preset")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig"));
const patchStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState"));
const selectFieldIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Breakdown field select not found"));
const selectPresetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Route preset select not found"));
const verifyProviderHydrationIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("titleInput.value === 'Show channel details'"));
const applyDetailActionIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Detail target apply button not found."));
const verifyPersistedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.campaign === '$row.campaign'"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes('Prospect Sprint')"));

assert.notEqual(patchConfigIndex, -1);
assert.notEqual(patchStateIndex, -1);
assert.notEqual(selectFieldIndex, -1);
assert.notEqual(selectPresetIndex, -1);
assert.notEqual(verifyProviderHydrationIndex, -1);
assert.notEqual(applyDetailActionIndex, -1);
assert.notEqual(verifyPersistedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(patchConfigIndex < patchStateIndex, true);
assert.equal(patchStateIndex < selectFieldIndex, true);
assert.equal(selectFieldIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < verifyProviderHydrationIndex, true);
assert.equal(verifyProviderHydrationIndex < applyDetailActionIndex, true);
assert.equal(applyDetailActionIndex < verifyPersistedStateIndex, true);
assert.equal(verifyPersistedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-provider-preset-scenario-assets ✓ provider-backed route presets survive a fresh semantic builder flow without authored drill metadata");
