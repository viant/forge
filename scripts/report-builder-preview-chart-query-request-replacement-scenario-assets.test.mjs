import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-request-replacement.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Stale chart query failed.") && expression.includes("Audio") && expression.includes("Social")),
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
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Audio')") && expression.includes("!chartText.includes('Alpha')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartReplacementPreStaleSettledCounts") && expression.includes("current.startCount === 2") && expression.includes("current.successCount === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 1") && expression.includes("successCount === 1") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes('Stale chart query failed.')") && expression.includes("chartText.includes('Audio')") && expression.includes("chartText.includes('Social')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Gamma") && expression.includes("Delta")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Gamma')") && expression.includes("!chartText.includes('Audio')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartReplacementRecoverySettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 3") && expression.includes("errorCount === 1") && expression.includes("successCount === 2") && expression.includes("requestCount === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headerText.includes('Avails by Date and Channel')") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('.forge-chart-legend-action').length >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-request-replacement")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Stale chart query failed."));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("Avails by Date and Channel"));
const firstStartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 1"));
const firstPendingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'success' || entry.phase === 'error')).length === 0"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const replacementVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Audio')") && String(step.expression || "").includes("!chartText.includes('Alpha')"));
const preRecoveryCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1") && String(step.expression || "").includes("successCount === 1"));
const recoveryInstallIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors") && String(step.expression || "").includes("Gamma") && String(step.expression || "").includes("Delta"));
const thirdPatchIndex = scenario.steps.findIndex((step, index) => index > recoveryInstallIndex && step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("staticFilters"));
const thirdStartIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 3"));
const recoveryVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Gamma')") && String(step.expression || "").includes("!chartText.includes('Audio')"));
const recoveryCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 3") && String(step.expression || "").includes("successCount === 2") && String(step.expression || "").includes("requestCount === 3"));
const finalViewIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headerText.includes('Avails by Date and Channel')") && String(step.expression || "").includes("chartText.includes('Gamma')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstStartIndex, -1);
assert.notEqual(firstPendingIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(replacementVisibleIndex, -1);
assert.notEqual(preRecoveryCountsIndex, -1);
assert.notEqual(recoveryInstallIndex, -1);
assert.notEqual(thirdPatchIndex, -1);
assert.notEqual(thirdStartIndex, -1);
assert.notEqual(recoveryVisibleIndex, -1);
assert.notEqual(recoveryCountsIndex, -1);
assert.notEqual(finalViewIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstStartIndex, true);
assert.equal(firstStartIndex < firstPendingIndex, true);
assert.equal(firstPendingIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < replacementVisibleIndex, true);
assert.equal(replacementVisibleIndex < preRecoveryCountsIndex, true);
assert.equal(preRecoveryCountsIndex < recoveryInstallIndex, true);
assert.equal(recoveryInstallIndex < thirdPatchIndex, true);
assert.equal(thirdPatchIndex < thirdStartIndex, true);
assert.equal(thirdStartIndex < recoveryVisibleIndex, true);
assert.equal(recoveryVisibleIndex < recoveryCountsIndex, true);
assert.equal(recoveryCountsIndex < finalViewIndex, true);

console.log("report-builder-preview-chart-query-request-replacement-scenario-assets ✓ a stale first chart query is replaced by the active request, and a later third request can recover ownership cleanly without stale leakage");
