import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-manual-rerun-collision.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 13);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":5000") && expression.includes("Stale chart query failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 2") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 5000") && expression.includes("preview.fetchBehaviors[0]?.error === 'Stale chart query failed.'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"avails\"]") && expression.includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 0") && expression.includes("preview.fetchBehaviors.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("run button disabled during chart query collision setup")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("fingerprints.length === 1") && expression.includes("requestKeys.length === 2") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartManualRerunPreStaleSettledCounts") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 1") && expression.includes("chartText.includes('Gamma')") && expression.includes("!chartText.includes('Stale chart query failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartManualRerunSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 1") && expression.includes("successCount === 1") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headerText.includes('Avails by Date and Channel')") && expression.includes("!text.includes('Stale chart query failed.')") && expression.includes("!text.includes('We couldn\\'t render these results')") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-manual-rerun-collision")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Stale chart query failed."));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const inFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const rerunClickIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("chart query collision setup"));
const collisionStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("requestKeys.length === 2"));
const visibleSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartManualRerunPreStaleSettledCounts"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 1"));
const finalViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('We couldn\\'t render these results')") && String(step.expression || "").includes("chartText.includes('Gamma')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(inFlightIndex, -1);
assert.notEqual(rerunClickIndex, -1);
assert.notEqual(collisionStateIndex, -1);
assert.notEqual(visibleSuccessIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < inFlightIndex, true);
assert.equal(inFlightIndex < rerunClickIndex, true);
assert.equal(rerunClickIndex < collisionStateIndex, true);
assert.equal(collisionStateIndex < visibleSuccessIndex, true);
assert.equal(visibleSuccessIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalViewIndex, true);

console.log("report-builder-preview-chart-query-manual-rerun-collision-scenario-assets ✓ same-fingerprint manual reruns with distinct request keys keep the active success visible while the stale delayed error stays suppressed");
