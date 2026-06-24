import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-chart-date.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] }")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceCollectionRows") && expression.includes("2026-05-01")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("config.drillMetadata.detailTargets.length === 0") && expression.includes("state.drillMetadata.detailTargets.length === 0")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Show date details")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parameterCount === 1") && expression.includes("target://example/performance/date-detail") && expression.includes("text.includes('2026-05-01')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-chart-date")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig"));
const quickChartIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails + HH Uniques by Date");
const replaceRowsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceCollectionRows"));
const clickBarIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle");
const clickDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("parameterCount === 1") && String(step?.expression || "").includes("target://example/performance/date-detail"));

assert.notEqual(patchConfigIndex, -1);
assert.notEqual(quickChartIndex, -1);
assert.notEqual(selectChartIndex, -1);
assert.notEqual(replaceRowsIndex, -1);
assert.notEqual(clickBarIndex, -1);
assert.notEqual(clickDetailIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(patchConfigIndex < quickChartIndex, true);
assert.equal(quickChartIndex < selectChartIndex, true);
assert.equal(selectChartIndex < replaceRowsIndex, true);
assert.equal(replaceRowsIndex < clickBarIndex, true);
assert.equal(clickBarIndex < clickDetailIndex, true);
assert.equal(clickDetailIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-provider-chart-date-scenario-assets ✓ chart-first provider-backed date detail works without authored drill metadata");
