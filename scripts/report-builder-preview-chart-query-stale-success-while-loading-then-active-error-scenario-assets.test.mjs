import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-stale-success-while-loading-then-active-error.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":1200") && expression.includes("Active chart query failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 2") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 1200") && expression.includes("preview.fetchBehaviors[1]?.delayMs === 5000")),
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
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 0") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartStaleSuccessActiveErrorCounts") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 1") && expression.includes("!text.includes('Active chart query failed.')") && expression.includes("chartText.includes('Display')") && expression.includes("chartText.includes('CTV')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartStaleSuccessActiveErrorSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 1") && expression.includes("successCount === 1") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-state') === 'error'") && expression.includes("frameText.includes(\"We couldn't render these results\")") && expression.includes("frameText.includes('Active chart query failed.')") && expression.includes("!chartWrap")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-stale-success-while-loading-then-active-error")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Active chart query failed."));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const firstInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const secondInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 2") && String(step.expression || "").includes("endings === 0") && String(step.expression || "").includes("preview.fetchBehaviors.length === 0"));
const staleSuccessVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartStaleSuccessActiveErrorCounts"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 1"));
const finalErrorViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-state') === 'error'") && String(step.expression || "").includes("frameText.includes('Active chart query failed.')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstInFlightIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(secondInFlightIndex, -1);
assert.notEqual(staleSuccessVisibleIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalErrorViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstInFlightIndex, true);
assert.equal(firstInFlightIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < secondInFlightIndex, true);
assert.equal(secondInFlightIndex < staleSuccessVisibleIndex, true);
assert.equal(staleSuccessVisibleIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalErrorViewIndex, true);

console.log("report-builder-preview-chart-query-stale-success-while-loading-then-active-error-scenario-assets ✓ stale delayed successes stay hidden while loading, but the eventual active error still owns the builder error surface");
