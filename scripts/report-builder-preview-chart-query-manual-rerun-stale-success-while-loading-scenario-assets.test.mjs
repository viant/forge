import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-manual-rerun-stale-success-while-loading.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Gamma") && expression.includes("Delta") && expression.includes("\"delayMs\":1200")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 0") && expression.includes("preview.fetchBehaviors.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("run button not found") && expression.includes("manual rerun stale success setup")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("requests.length === 2") && expression.includes("fingerprints.length === 1") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartManualRerunSuccessWhileLoadingCounts") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 1") && expression.includes("chartText.includes('Display')") && expression.includes("chartText.includes('CTV')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')") && expression.includes("!chartText.includes('Stale chart query failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 2") && expression.includes("endings === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartManualRerunSuccessWhileLoadingFinalCounts") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 2") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 0") && expression.includes("successCount === 2") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headerText.includes('Avails by Date and Channel')") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')") && expression.includes("!text.includes('We couldn\\'t render these results')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-manual-rerun-stale-success-while-loading")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Gamma") && String(step.expression || "").includes("Delta"));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const firstInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const rerunClickIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("run button not found"));
const rerunStartedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("requests.length === 2") && String(step.expression || "").includes("fingerprints.length === 1"));
const whileLoadingVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartManualRerunSuccessWhileLoadingCounts"));
const rerunVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("return chartText.includes('Gamma') && chartText.includes('Delta')"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 0") && String(step.expression || "").includes("successCount === 2"));
const finalViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headerText.includes('Avails by Date and Channel')") && String(step.expression || "").includes("chartText.includes('Gamma')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstInFlightIndex, -1);
assert.notEqual(rerunClickIndex, -1);
assert.notEqual(rerunStartedIndex, -1);
assert.notEqual(whileLoadingVisibleIndex, -1);
assert.notEqual(rerunVisibleIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstInFlightIndex, true);
assert.equal(firstInFlightIndex < rerunClickIndex, true);
assert.equal(rerunClickIndex < rerunStartedIndex, true);
assert.equal(rerunStartedIndex < whileLoadingVisibleIndex, true);
assert.equal(whileLoadingVisibleIndex < rerunVisibleIndex, true);
assert.equal(rerunVisibleIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalViewIndex, true);

console.log("report-builder-preview-chart-query-manual-rerun-stale-success-while-loading-scenario-assets ✓ stale delayed successes stay hidden during same-fingerprint manual reruns and do not displace the eventual rerun result");
