import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-empty-resolution.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 9);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"rows\":[]") && expression.includes("\"hasMore\":false")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 0") && expression.includes("chartText.includes('Display')") && expression.includes("chartText.includes('CTV')") && expression.includes("!chartText.includes('No data for the selected period.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'success').length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartEmptyResolutionSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 600")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 1") && expression.includes("errorCount === 0") && expression.includes("successCount === 1") && expression.includes("requestCount === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('No data for the selected period.')") && expression.includes("!chartText.includes('Display')") && expression.includes("!chartText.includes('CTV')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-empty-resolution")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const inFlightChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("chartText.includes('Display')") && String(step.expression || "").includes("!chartText.includes('No data for the selected period.')"));
const successIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'success').length === 1"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartEmptyResolutionSettledCounts"));
const finalEmptyStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('No data for the selected period.')") && String(step.expression || "").includes("!chartText.includes('Display')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(chartPatchIndex, -1);
assert.notEqual(inFlightChartIndex, -1);
assert.notEqual(successIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalEmptyStateIndex, -1);

assert.equal(installBehaviorIndex < chartPatchIndex, true);
assert.equal(chartPatchIndex < inFlightChartIndex, true);
assert.equal(inFlightChartIndex < successIndex, true);
assert.equal(successIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalEmptyStateIndex, true);

console.log("report-builder-preview-chart-query-empty-resolution-scenario-assets ✓ empty chart queries transition from the seeded visible chart to the explicit empty-state chart without flashing loading or fallback diagnostics");
