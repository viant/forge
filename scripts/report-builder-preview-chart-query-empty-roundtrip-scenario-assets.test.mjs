import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-empty-roundtrip.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 11);

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
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'success').length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-view-mode') === 'chart'") && expression.includes("text.includes('No data for the selected period.')") && expression.includes("!text.includes('Refreshing report data')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"viewMode\":\"table\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-view-mode') === 'table'") && expression.includes("forge-report-builder__table-wrap")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"viewMode\":\"chart\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartEmptyRoundtripSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 600")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-empty-roundtrip")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const firstSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'success').length === 1"));
const firstEmptyChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-view-mode') === 'chart'") && String(step.expression || "").includes("text.includes('No data for the selected period.')") && String(step.expression || "").includes("!text.includes('Refreshing report data')"));
const switchTableIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"viewMode\":\"table\""));
const tableVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-view-mode') === 'table'"));
const switchBackChartIndex = scenario.steps.findIndex((step, index) => index > tableVisibleIndex && step?.type === "eval" && String(step.expression || "").includes("\"viewMode\":\"chart\""));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartEmptyRoundtripSettledCounts"));
const finalChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 1") && String(step.expression || "").includes("text.includes('No data for the selected period.')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(chartPatchIndex, -1);
assert.notEqual(firstSuccessIndex, -1);
assert.notEqual(firstEmptyChartIndex, -1);
assert.notEqual(switchTableIndex, -1);
assert.notEqual(tableVisibleIndex, -1);
assert.notEqual(switchBackChartIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalChartIndex, -1);

assert.equal(installBehaviorIndex < chartPatchIndex, true);
assert.equal(chartPatchIndex < firstSuccessIndex, true);
assert.equal(firstSuccessIndex < firstEmptyChartIndex, true);
assert.equal(firstEmptyChartIndex < switchTableIndex, true);
assert.equal(switchTableIndex < tableVisibleIndex, true);
assert.equal(tableVisibleIndex < switchBackChartIndex, true);
assert.equal(switchBackChartIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalChartIndex, true);

console.log("report-builder-preview-chart-query-empty-roundtrip-scenario-assets ✓ empty chart results stay stable when toggling chart/table/chart without introducing a second request or fallback error state");
