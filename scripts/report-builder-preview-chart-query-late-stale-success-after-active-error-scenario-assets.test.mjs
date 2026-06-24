import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-late-stale-success-after-active-error.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":5000") && expression.includes("Active chart query failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 2") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 5000") && expression.includes("preview.fetchBehaviors[1]?.error === 'Active chart query failed.'")),
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
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Active chart query failed.')") && expression.includes("!text.includes('Stale chart query failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartLateStaleSuccessErrorCounts") && expression.includes("current.errorCount === 1") && expression.includes("current.successCount === 0") && expression.includes("Date.now() - settled.lastChangedAt >= 350")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartLateStaleSuccessErrorSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-late-stale-success-after-active-error")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Active chart query failed."));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const inFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const activeErrorVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Active chart query failed.')") && String(step.expression || "").includes("!text.includes('Stale chart query failed.')"));
const hiddenLateSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartLateStaleSuccessErrorCounts"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 1"));
const finalErrorViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-state') === 'error'") && String(step.expression || "").includes("frameText.includes('Active chart query failed.')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(inFlightIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(activeErrorVisibleIndex, -1);
assert.notEqual(hiddenLateSuccessIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalErrorViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < inFlightIndex, true);
assert.equal(inFlightIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < activeErrorVisibleIndex, true);
assert.equal(activeErrorVisibleIndex < hiddenLateSuccessIndex, true);
assert.equal(hiddenLateSuccessIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalErrorViewIndex, true);

console.log("report-builder-preview-chart-query-late-stale-success-after-active-error-scenario-assets ✓ stale delayed successes stay suppressed after the active chart query already failed");
