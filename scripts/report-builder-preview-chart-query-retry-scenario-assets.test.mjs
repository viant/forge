import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-retry.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 18);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"avails\"]") && expression.includes("Visual Story") && expression.includes("Full Query")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Chart-first view for the active scope using the full query result set.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.type === 'chartQuery' && entry.phase === 'start').length > 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts > 0 && starts === endings")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartRetryBaseline") && expression.includes("replaceFetchBehaviors([{ match: { type: 'chartQuery' }, error: 'Chart query failed.' }])")),
  true,
);
assert.equal(
  scenario.steps.filter((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true).length === 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("errorCount > baseline.errorCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartRetrySettledErrorCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === baseline.startCount + 1") && expression.includes("errorCount === baseline.errorCount + 1") && expression.includes("requestCount === baseline.requestCount + 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("successCount > baseline.successCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartRetrySettledSuccessCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === baseline.startCount + 2") && expression.includes("errorCount === baseline.errorCount + 1") && expression.includes("successCount === baseline.successCount + 1") && expression.includes("requestCount === baseline.requestCount + 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-retry")),
  true,
);

const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const firstSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts > 0 && starts === endings"));
const installRetryFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__chartRetryBaseline") && String(step.expression || "").includes("Chart query failed."));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const errorObservedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("errorCount > baseline.errorCount"));
const errorSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartRetrySettledErrorCounts"));
const errorCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === baseline.startCount + 1"));
const secondRunIndex = scenario.steps.findIndex((step, index) => index > errorCountsIndex && step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const successObservedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("successCount > baseline.successCount"));
const successSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartRetrySettledSuccessCounts"));
const successCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === baseline.startCount + 2"));
const readyChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelector('.forge-report-builder')?.getAttribute('data-report-builder-state') === 'chart'"));
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));

assert.notEqual(chartPatchIndex, -1);
assert.notEqual(firstSettledIndex, -1);
assert.notEqual(installRetryFailureIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(errorObservedIndex, -1);
assert.notEqual(errorSettledIndex, -1);
assert.notEqual(errorCountsIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(successObservedIndex, -1);
assert.notEqual(successSettledIndex, -1);
assert.notEqual(successCountsIndex, -1);
assert.notEqual(readyChartIndex, -1);
assert.notEqual(legendReadyIndex, -1);

assert.equal(chartPatchIndex < firstSettledIndex, true);
assert.equal(firstSettledIndex < installRetryFailureIndex, true);
assert.equal(installRetryFailureIndex < firstRunIndex, true);
assert.equal(firstRunIndex < errorObservedIndex, true);
assert.equal(errorObservedIndex < errorSettledIndex, true);
assert.equal(errorSettledIndex < errorCountsIndex, true);
assert.equal(errorCountsIndex < secondRunIndex, true);
assert.equal(secondRunIndex < successObservedIndex, true);
assert.equal(successObservedIndex < successSettledIndex, true);
assert.equal(successSettledIndex < successCountsIndex, true);
assert.equal(successCountsIndex < readyChartIndex, true);
assert.equal(readyChartIndex < legendReadyIndex, true);

console.log("report-builder-preview-chart-query-retry-scenario-assets ✓ chart-query retry records a failed rerun, clears injected failure behavior, and succeeds on the next run without regressing the chart surface");
