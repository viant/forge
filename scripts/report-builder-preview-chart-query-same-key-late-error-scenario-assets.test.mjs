import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-same-key-late-error.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 19);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Stale chart query failed.") && expression.includes("Audio") && expression.includes("Social") && expression.includes("Gamma") && expression.includes("Delta")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 3") && expression.includes("preview.fetchBehaviors[0]?.delayMs === 5000") && expression.includes("preview.fetchBehaviors[0]?.error === 'Stale chart query failed.'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"avails\"]") && expression.includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 0") && expression.includes("preview.fetchBehaviors.length === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Audio')") && expression.includes("chartText.includes('Social')") && expression.includes("!chartText.includes('Stale chart query failed.')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartSameKeyPreRecoverySettledCounts") && expression.includes("current.startCount === 2") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.type === 'chartQuery' && entry.phase === 'start').length === 3") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')") && expression.includes("!chartText.includes('Audio')") && expression.includes("!chartText.includes('Social')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartSameKeyPreLateErrorSettledCounts") && expression.includes("current.startCount === 3") && expression.includes("current.errorCount === 0") && expression.includes("current.successCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 3") && expression.includes("endings === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartSameKeyFinalSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 3") && expression.includes("errorCount === 1") && expression.includes("successCount === 2") && expression.includes("requestCount === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headerText.includes('Avails by Date and Channel')") && expression.includes("!headerText.includes('HH Uniques by Date and Channel')") && expression.includes("!text.includes('Stale chart query failed.')") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-same-key-late-error")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Stale chart query failed."));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("Avails by Date and Channel"));
const firstInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 2"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const replacementVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Audio')") && String(step.expression || "").includes("chartText.includes('Social')"));
const preRecoveryCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartSameKeyPreRecoverySettledCounts"));
const thirdPatchIndex = scenario.steps.findIndex((step, index) => index > preRecoveryCountsIndex && step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("staticFilters"));
const thirdStartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.type === 'chartQuery' && entry.phase === 'start').length === 3"));
const recoveryVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Gamma')") && String(step.expression || "").includes("!chartText.includes('Audio')"));
const preLateErrorCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartSameKeyPreLateErrorSettledCounts"));
const finalCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 3") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 2"));
const finalViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headerText.includes('Avails by Date and Channel')") && String(step.expression || "").includes("chartText.includes('Gamma')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstInFlightIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(replacementVisibleIndex, -1);
assert.notEqual(preRecoveryCountsIndex, -1);
assert.notEqual(thirdPatchIndex, -1);
assert.notEqual(thirdStartIndex, -1);
assert.notEqual(recoveryVisibleIndex, -1);
assert.notEqual(preLateErrorCountsIndex, -1);
assert.notEqual(finalCountsIndex, -1);
assert.notEqual(finalViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstInFlightIndex, true);
assert.equal(firstInFlightIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < replacementVisibleIndex, true);
assert.equal(replacementVisibleIndex < preRecoveryCountsIndex, true);
assert.equal(preRecoveryCountsIndex < thirdPatchIndex, true);
assert.equal(thirdPatchIndex < thirdStartIndex, true);
assert.equal(thirdStartIndex < recoveryVisibleIndex, true);
assert.equal(recoveryVisibleIndex < preLateErrorCountsIndex, true);
assert.equal(preLateErrorCountsIndex < finalCountsIndex, true);
assert.equal(finalCountsIndex < finalViewIndex, true);

console.log("report-builder-preview-chart-query-same-key-late-error-scenario-assets ✓ a stale late error for the same key never takes ownership away from the later active recovery result");
