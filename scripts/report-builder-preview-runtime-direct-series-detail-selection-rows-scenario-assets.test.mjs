import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-direct-series-detail-selection-rows.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 13);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors") && expression.includes("target://example/performance/date-detail") && expression.includes("country: '$row.country'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceCollectionRows") && expression.includes("2026-05-01") && expression.includes("country: 'US'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: 2026-05-01 • avails")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parameterCount === 2") && expression.includes("target://example/performance/date-detail") && expression.includes("2026-05-01") && expression.includes("country") && expression.includes("US") && expression.includes("!runtimeText.includes('Detail target resolved with omitted parameters: country.')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-direct-series-detail-selection-rows-proof")),
  true,
);

const injectTargetBehaviorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors"));
const choosePresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date");
const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceCollectionRows"));
const rowsRenderedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("34.7K"));
const chartReadyIndex = findStepIndex((step) => step?.type === "waitSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle");
const clickMarkIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: 2026-05-01 • avails"));
const clickDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details");
const resolvedTargetIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const hostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("parameterCount === 2")
  && String(step?.expression || "").includes("target://example/performance/date-detail")
  && String(step?.expression || "").includes("2026-05-01")
  && String(step?.expression || "").includes("country")
  && String(step?.expression || "").includes("US"));

assert.notEqual(injectTargetBehaviorIndex, -1);
assert.notEqual(choosePresetIndex, -1);
assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(rowsRenderedIndex, -1);
assert.notEqual(chartReadyIndex, -1);
assert.notEqual(clickMarkIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(clickDetailIndex, -1);
assert.notEqual(resolvedTargetIndex, -1);
assert.notEqual(hostIntentIndex, -1);

assert.equal(injectTargetBehaviorIndex < choosePresetIndex, true);
assert.equal(choosePresetIndex < replaceRowsIndex, true);
assert.equal(replaceRowsIndex < rowsRenderedIndex, true);
assert.equal(rowsRenderedIndex < chartReadyIndex, true);
assert.equal(chartReadyIndex < clickMarkIndex, true);
assert.equal(clickMarkIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < clickDetailIndex, true);
assert.equal(clickDetailIndex < resolvedTargetIndex, true);
assert.equal(resolvedTargetIndex < hostIntentIndex, true);

console.log("report-builder-preview-runtime-direct-series-detail-selection-rows-scenario-assets ✓ direct-series chart selection resolves the semantic date detail target with row-backed parameters");
