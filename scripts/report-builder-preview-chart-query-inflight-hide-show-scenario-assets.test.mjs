import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-inflight-hide-show.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 16);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":5000")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 5000")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"avails\"]") && expression.includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'success' || entry.phase === 'error')).length === 0")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.text === "table"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("root?.getAttribute('data-report-builder-state') === 'table'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.text === "chart"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartInflightHideShowSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 1") && expression.includes("errorCount === 0") && expression.includes("successCount === 1") && expression.includes("requestCount === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Chart-first view for the active scope using the full query result set.") && expression.includes("!text.includes('Refreshing report data')") && expression.includes("!text.includes('We couldn\\'t render these results')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-inflight-hide-show")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const inflightStartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 1"));
const inflightPendingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'success' || entry.phase === 'error')).length === 0"));
const switchTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "table");
const tableStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("root?.getAttribute('data-report-builder-state') === 'table'"));
const switchChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "chart");
const settledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("endings === 1"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartInflightHideShowSettledCounts"));
const finalChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 1") && String(step.expression || "").includes("successCount === 1") && String(step.expression || "").includes("requestCount === 1"));
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(chartPatchIndex, -1);
assert.notEqual(inflightStartIndex, -1);
assert.notEqual(inflightPendingIndex, -1);
assert.notEqual(switchTableIndex, -1);
assert.notEqual(tableStateIndex, -1);
assert.notEqual(switchChartIndex, -1);
assert.notEqual(settledIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalChartIndex, -1);
assert.notEqual(legendReadyIndex, -1);

assert.equal(installBehaviorIndex < chartPatchIndex, true);
assert.equal(chartPatchIndex < inflightStartIndex, true);
assert.equal(inflightStartIndex < inflightPendingIndex, true);
assert.equal(inflightPendingIndex < switchTableIndex, true);
assert.equal(switchTableIndex < tableStateIndex, true);
assert.equal(tableStateIndex < switchChartIndex, true);
assert.equal(switchChartIndex < settledIndex, true);
assert.equal(settledIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalChartIndex, true);
assert.equal(finalChartIndex < legendReadyIndex, true);

console.log("report-builder-preview-chart-query-inflight-hide-show-scenario-assets ✓ hiding a chart while its full-query fetch is inflight does not cancel the request, and the chart settles cleanly when shown again");
