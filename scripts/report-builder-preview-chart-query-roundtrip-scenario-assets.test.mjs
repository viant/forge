import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-chart-query-roundtrip.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("\"delayMs\":5000") && expression.includes("Audio") && expression.includes("Gamma") && expression.includes("Delta")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 3") && expression.includes("entry?.match?.type === 'chartquery'")),
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
  expressions.some((expression) => expression.includes("starts === 1") && expression.includes("endings === 0") && expression.includes("preview.fetchBehaviors.length === 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"selectedMeasures\":[\"hhUniqs\"]") && expression.includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("chartText.includes('Audio')") && expression.includes("chartText.includes('Social')") && expression.includes("!chartText.includes('Alpha')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 2") && expression.includes("preview.fetchBehaviors.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("entry.phase === 'start').length === 3") && expression.includes("preview.fetchBehaviors.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("starts === 3") && expression.includes("endings === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__chartRoundTripSettledCounts") && expression.includes("Date.now() - settled.lastChangedAt >= 1200")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("startCount === 3") && expression.includes("errorCount === 0") && expression.includes("successCount === 3") && expression.includes("requestCount === 3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headerText.includes('Avails by Date and Channel')") && expression.includes("chartText.includes('Gamma')") && expression.includes("chartText.includes('Delta')") && expression.includes("!chartText.includes('Audio')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-roundtrip")),
  true,
);

const installBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const firstPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const firstInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 2"));
const secondPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const secondVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Audio')") && String(step.expression || "").includes("chartText.includes('Social')"));
const secondInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 2") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const thirdPatchIndex = scenario.steps.findIndex((step, index) => index > secondInFlightIndex && step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]") && String(step.expression || "").includes("\"staticFilters\""));
const thirdInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("entry.phase === 'start').length === 3") && String(step.expression || "").includes("preview.fetchBehaviors.length === 0"));
const settledCountsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__chartRoundTripSettledCounts"));
const finalRoundtripIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("headerText.includes('Avails by Date and Channel')") && String(step.expression || "").includes("chartText.includes('Gamma')") && String(step.expression || "").includes("chartText.includes('Delta')"));

assert.notEqual(installBehaviorIndex, -1);
assert.notEqual(firstPatchIndex, -1);
assert.notEqual(firstInFlightIndex, -1);
assert.notEqual(secondPatchIndex, -1);
assert.notEqual(secondVisibleIndex, -1);
assert.notEqual(secondInFlightIndex, -1);
assert.notEqual(thirdPatchIndex, -1);
assert.notEqual(thirdInFlightIndex, -1);
assert.notEqual(settledCountsIndex, -1);
assert.notEqual(finalRoundtripIndex, -1);

assert.equal(installBehaviorIndex < firstPatchIndex, true);
assert.equal(firstPatchIndex < firstInFlightIndex, true);
assert.equal(firstInFlightIndex < secondPatchIndex, true);
assert.equal(secondPatchIndex < secondVisibleIndex, true);
assert.equal(secondVisibleIndex < secondInFlightIndex, true);
assert.equal(secondInFlightIndex < thirdPatchIndex, true);
assert.equal(thirdPatchIndex < thirdInFlightIndex, true);
assert.equal(thirdInFlightIndex < settledCountsIndex, true);
assert.equal(settledCountsIndex < finalRoundtripIndex, true);

console.log("report-builder-preview-chart-query-roundtrip-scenario-assets ✓ three successful chart-query fetches can roundtrip avails to hh uniques and back without leaving stale series or request state behind");
