import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-stale-error-while-loading.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Stale chart query failed.") && expression.includes("\"delayMs\":5000")),
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
  expressions.some((expression) => expression.includes("__chartStaleWhileLoadingCounts") && expression.includes("current.errorCount === 1") && expression.includes("current.successCount === 0") && expression.includes("!text.includes('Refreshing report data')") && expression.includes("chartText.includes('Display')") && expression.includes("chartText.includes('CTV')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Audio')") && expression.includes("chartText.includes('Social')") && expression.includes("!chartText.includes('Alpha')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartStaleWhileLoadingSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 1") && expression.includes("successCount === 1") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-state') === 'chart'") && expression.includes("!text.includes('Refreshing report data')") && expression.includes("!text.includes('Stale chart query failed.')") && expression.includes("chartText.includes('Audio')") && expression.includes("chartText.includes('Social')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-stale-error-while-loading")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("\"delayMs\":5000"));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const firstInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const secondInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 2") && String(step.expression || "").includes("endings === 0") && String(step.expression || "").includes("preview.fetchBehaviors.length === 0"));
const staleSuppressedWhileLoadingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartStaleWhileLoadingCounts"));
const activeChartVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("return chartText.includes('Audio') && chartText.includes('Social')"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 1"));
const finalChartViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-state') === 'chart'") && String(step.expression || "").includes("headerText.includes('HH Uniques by Date and Channel')") && String(step.expression || "").includes("chartText.includes('Audio') && chartText.includes('Social') && !chartText.includes('Alpha')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstInFlightIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(secondInFlightIndex, -1);
assert.notEqual(staleSuppressedWhileLoadingIndex, -1);
assert.notEqual(activeChartVisibleIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalChartViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstInFlightIndex, true);
assert.equal(firstInFlightIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < secondInFlightIndex, true);
assert.equal(secondInFlightIndex < staleSuppressedWhileLoadingIndex, true);
assert.equal(staleSuppressedWhileLoadingIndex < activeChartVisibleIndex, true);
assert.equal(activeChartVisibleIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalChartViewIndex, true);

console.log("report-builder-preview-chart-query-stale-error-while-loading-scenario-assets ✓ stale delayed errors stay hidden during active loading and do not displace the eventual active chart result");
