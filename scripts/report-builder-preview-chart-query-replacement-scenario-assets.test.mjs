import assert from "node:assert/strict";

import replacementSuccessScenario from "../tests/report-builder-preview-semantic-chart-query-replacement-success.scenario.mjs";
import replacementErrorScenario from "../tests/report-builder-preview-semantic-chart-query-replacement-error.scenario.mjs";

for (const scenario of [replacementSuccessScenario, replacementErrorScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 720,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length >= 11);
}

function getExpressions(scenario) {
  return scenario.steps
    .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
    .map((step) => String(step.expression || ""));
}

function findStepIndex(scenario, predicate) {
  return scenario.steps.findIndex(predicate);
}

const successExpressions = getExpressions(replacementSuccessScenario);

assert.equal(
  successExpressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Audio") && expression.includes("Social")),
  true,
);
assert.equal(
  successExpressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("starts === 1") && expression.includes("endings === 0")),
  true,
);
assert.equal(
  replacementSuccessScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  successExpressions.some((expression) => expression.includes("chartText.includes('Audio')") && expression.includes("!chartText.includes('Alpha')")),
  true,
);
assert.equal(
  successExpressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 0") && expression.includes("successCount === 2") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  successExpressions.some((expression) => expression.includes("!text.includes(\"We couldn't render these results\")") && expression.includes("!text.includes('Stale chart query failed.')")),
  true,
);
assert.equal(
  replacementSuccessScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-replacement-success")),
  true,
);

const successInstallIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const successFirstPatchIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const successFirstInFlightIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const successSecondPatchIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const successResolvedIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("chartText.includes('Audio')"));
const successCountsIndex = findStepIndex(replacementSuccessScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("successCount === 2"));

assert.notEqual(successInstallIndex, -1);
assert.notEqual(successFirstPatchIndex, -1);
assert.notEqual(successFirstInFlightIndex, -1);
assert.notEqual(successSecondPatchIndex, -1);
assert.notEqual(successResolvedIndex, -1);
assert.notEqual(successCountsIndex, -1);
assert.equal(successInstallIndex < successFirstPatchIndex, true);
assert.equal(successFirstPatchIndex < successFirstInFlightIndex, true);
assert.equal(successFirstInFlightIndex < successSecondPatchIndex, true);
assert.equal(successSecondPatchIndex < successResolvedIndex, true);
assert.equal(successResolvedIndex < successCountsIndex, true);

const errorExpressions = getExpressions(replacementErrorScenario);

assert.equal(
  errorExpressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("preview.resetCounters()") && expression.includes("Replacement chart query failed.")),
  true,
);
assert.equal(
  errorExpressions.some((expression) => expression.includes("preview.fetchBehaviors.length === 1") && expression.includes("starts === 1") && expression.includes("endings === 0")),
  true,
);
assert.equal(
  replacementErrorScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("HH Uniques by Date and Channel")),
  true,
);
assert.equal(
  errorExpressions.some((expression) => expression.includes("startCount === 2") && expression.includes("errorCount === 1") && expression.includes("successCount === 1") && expression.includes("requestCount === 2")),
  true,
);
assert.equal(
  errorExpressions.some((expression) => expression.includes("text.includes('render these results')") && expression.includes("text.includes('Replacement chart query failed.')")),
  true,
);
assert.equal(
  replacementErrorScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-query-replacement-error")),
  true,
);

const errorInstallIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("replaceFetchBehaviors"));
const errorFirstPatchIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"avails\"]"));
const errorFirstInFlightIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("starts === 1") && String(step.expression || "").includes("preview.fetchBehaviors.length === 1"));
const errorSecondPatchIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "eval" && String(step.expression || "").includes("\"selectedMeasures\":[\"hhUniqs\"]"));
const errorCountsIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("startCount === 2") && String(step.expression || "").includes("errorCount === 1"));
const errorVisibleIndex = findStepIndex(replacementErrorScenario, (step) => step?.type === "waitForEval" && String(step.expression || "").includes("Replacement chart query failed."));

assert.notEqual(errorInstallIndex, -1);
assert.notEqual(errorFirstPatchIndex, -1);
assert.notEqual(errorFirstInFlightIndex, -1);
assert.notEqual(errorSecondPatchIndex, -1);
assert.notEqual(errorCountsIndex, -1);
assert.notEqual(errorVisibleIndex, -1);
assert.equal(errorInstallIndex < errorFirstPatchIndex, true);
assert.equal(errorFirstPatchIndex < errorFirstInFlightIndex, true);
assert.equal(errorFirstInFlightIndex < errorSecondPatchIndex, true);
assert.equal(errorSecondPatchIndex < errorCountsIndex, true);
assert.equal(errorCountsIndex < errorVisibleIndex, true);

console.log("report-builder-preview-chart-query-replacement-scenario-assets ✓ active replacement chart queries own the builder surface for both success and error outcomes while stale first requests stay ignored");
