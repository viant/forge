import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-standalone-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("applyStandaloneRuntimeRefinement") && expression.includes("Keep only = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__standaloneRuntimeRetryBaseline") && expression.includes("requestFingerprint") && expression.includes("phase === 'error'") && expression.includes("phase === 'success'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.") && expression.includes("requestFingerprint")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.type === 'runtimePreview'") && expression.includes("phase === 'success'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("errorCount > baseline.errorCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("panelText.includes('Runtime preview fetch failed.')") && expression.includes("pageText.includes('Keep only = Display')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("successCount > baseline.successCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!panelText.includes('runtime preview fetch failed.')") && expression.includes("panelText.includes('display')") && expression.includes("!panelText.includes('ctv')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Inventory · Top Channels")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Keep only = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-standalone-retry")),
  true,
);

const quickButtonIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const presetPickIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Inventory · Top Channels");
const keepRefinementIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("applyStandaloneRuntimeRefinement"));
const initialSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("entry.type === 'runtimePreview'") && String(step?.expression || "").includes("phase === 'success'"));
const baselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__standaloneRuntimeRetryBaseline"));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run");
const errorCountIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("errorCount > baseline.errorCount"));
const errorVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("panelText.includes('Runtime preview fetch failed.')"));
const behaviorsClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("fetchBehaviors.length === 0"));
const secondRunIndex = scenario.steps.findIndex((step, index) => index > behaviorsClearedIndex && step?.type === "clickRole" && step?.name === "Run");
const successCountIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("successCount > baseline.successCount"));
const recoveredPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!panelText.includes('runtime preview fetch failed.')"));

assert.notEqual(quickButtonIndex, -1);
assert.notEqual(presetPickIndex, -1);
assert.notEqual(keepRefinementIndex, -1);
assert.notEqual(initialSuccessIndex, -1);
assert.notEqual(baselineIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(errorCountIndex, -1);
assert.notEqual(errorVisibleIndex, -1);
assert.notEqual(behaviorsClearedIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(successCountIndex, -1);
assert.notEqual(recoveredPanelIndex, -1);

assert.equal(quickButtonIndex < presetPickIndex, true);
assert.equal(presetPickIndex < keepRefinementIndex, true);
assert.equal(keepRefinementIndex < initialSuccessIndex, true);
assert.equal(initialSuccessIndex < baselineIndex, true);
assert.equal(baselineIndex < firstRunIndex, true);
assert.equal(firstRunIndex < errorCountIndex, true);
assert.equal(errorCountIndex < errorVisibleIndex, true);
assert.equal(errorVisibleIndex < behaviorsClearedIndex, true);
assert.equal(behaviorsClearedIndex < secondRunIndex, true);
assert.equal(secondRunIndex < successCountIndex, true);
assert.equal(successCountIndex < recoveredPanelIndex, true);

console.log("report-builder-preview-runtime-standalone-retry-scenario-assets ✓ standalone runtime retries from a transient fetch failure and recovers filtered runtime output");
