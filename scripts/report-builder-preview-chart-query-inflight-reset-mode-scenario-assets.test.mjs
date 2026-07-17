import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-inflight-reset-mode.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("chartDataMode") && expression.includes("fullQuery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":5000") && expression.includes("Gamma")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 2") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 5000")),
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
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("currentPage")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-builder__chart-wrap")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("fullQuery") && expression.includes("chartRowLimit")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 2") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')") && expression.includes("!chartText.includes('Alpha')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartResetSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 0") && expression.includes("successCount === 2") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("forge-report-builder__chart-wrap") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-inflight-reset-mode")),
  true,
);

const setFullQueryIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("patchBuilderConfig") && String(step.expression || "").includes("fullQuery"));
const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const chartPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const inflightStartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 1"));
const inflightPendingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'success' || entry.phase === 'error')).length === 0"));
const switchCurrentPageIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("patchBuilderConfig") && String(step.expression || "").includes("currentPage"));
const currentPageViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-builder__chart-wrap"));
const restoreFullQueryIndex = scenario.steps.findIndex((step, index) => index > currentPageViewIndex && step?.type === "eval" && String(step.expression || "").includes("patchBuilderConfig") && String(step.expression || "").includes("fullQuery"));
const restartedFetchIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 2") && String(step.expression || "").includes("preview.fetchBehaviors.length === 0"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartResetSettledCounts"));
const finalChartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("successCount === 2") && String(step.expression || "").includes("requestCount === 2"));
const legendReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2"));

assert.notEqual(setFullQueryIndex, -1);
assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(chartPatchIndex, -1);
assert.notEqual(inflightStartIndex, -1);
assert.notEqual(inflightPendingIndex, -1);
assert.notEqual(switchCurrentPageIndex, -1);
assert.notEqual(currentPageViewIndex, -1);
assert.notEqual(restoreFullQueryIndex, -1);
assert.notEqual(restartedFetchIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalChartIndex, -1);
assert.notEqual(legendReadyIndex, -1);

assert.equal(setFullQueryIndex < installBehaviorIndex, true);
assert.equal(installBehaviorIndex < chartPatchIndex, true);
assert.equal(chartPatchIndex < inflightStartIndex, true);
assert.equal(inflightStartIndex < inflightPendingIndex, true);
assert.equal(inflightPendingIndex < switchCurrentPageIndex, true);
assert.equal(switchCurrentPageIndex < currentPageViewIndex, true);
assert.equal(currentPageViewIndex < restoreFullQueryIndex, true);
assert.equal(restoreFullQueryIndex < restartedFetchIndex, true);
assert.equal(restartedFetchIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalChartIndex, true);
assert.equal(finalChartIndex < legendReadyIndex, true);

console.log("report-builder-preview-chart-query-inflight-reset-mode-scenario-assets ✓ resetting chart data mode during an inflight full-query fetch discards the stale request and reruns cleanly when full-query mode is restored");
