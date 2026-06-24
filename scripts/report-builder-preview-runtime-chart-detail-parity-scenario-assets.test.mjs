import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-chart-detail-parity.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "eval"
    && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-action")
    && String(step?.expression || "").includes("Show channel details")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("forge-report-builder__runtime-preview") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("forge-report-runtime-host-intent") && expression.includes("!entry.closest('.forge-report-builder__runtime-preview')") && expression.includes("target://example/performance/channel-detail") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel") && expression.includes("Selected value:") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!entry.closest('.forge-report-builder__runtime-preview')") && expression.includes("Selected value:") && expression.includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-chart-detail-parity")),
  true,
);

const quickChartIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__chart-action-button--quick");
const selectChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Avails by Date and Channel");
const previewSelectedValueIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel")
  && String(step?.expression || "").includes("Selected value:")
  && String(step?.expression || "").includes("Display"));
const clickPreviewDetailIndex = findStepIndex((step) => step?.type === "eval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-chart-action")
  && String(step?.expression || "").includes("Show channel details"));
const verifyPreviewIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("forge-report-builder__runtime-preview")
  && String(step?.expression || "").includes("target://example/performance/channel-detail")
  && String(step?.expression || "").includes("Display"));
const dismissPreviewIntentIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Dismiss intent"));
const standaloneSelectedValueIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("!entry.closest('.forge-report-builder__runtime-preview')")
  && String(step?.expression || "").includes("Selected value:")
  && String(step?.expression || "").includes("Display"));
const clickStandaloneDetailIndex = findStepIndex((step) => step?.type === "eval"
  && String(step?.expression || "").includes("!entry.closest('.forge-report-builder__runtime-preview')")
  && String(step?.expression || "").includes(".forge-report-runtime-chart-action")
  && String(step?.expression || "").includes("Show channel details"));
const verifyStandaloneIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("!entry.closest('.forge-report-builder__runtime-preview')")
  && String(step?.expression || "").includes("target://example/performance/channel-detail")
  && String(step?.expression || "").includes("Display"));

assert.notEqual(quickChartIndex, -1);
assert.notEqual(selectChartIndex, -1);
assert.notEqual(previewSelectedValueIndex, -1);
assert.notEqual(clickPreviewDetailIndex, -1);
assert.notEqual(verifyPreviewIntentIndex, -1);
assert.notEqual(dismissPreviewIntentIndex, -1);
assert.notEqual(standaloneSelectedValueIndex, -1);
assert.notEqual(clickStandaloneDetailIndex, -1);
assert.notEqual(verifyStandaloneIntentIndex, -1);

assert.equal(quickChartIndex < selectChartIndex, true);
assert.equal(selectChartIndex < previewSelectedValueIndex, true);
assert.equal(previewSelectedValueIndex < clickPreviewDetailIndex, true);
assert.equal(clickPreviewDetailIndex < verifyPreviewIntentIndex, true);
assert.equal(verifyPreviewIntentIndex < dismissPreviewIntentIndex, true);
assert.equal(dismissPreviewIntentIndex < standaloneSelectedValueIndex, true);
assert.equal(standaloneSelectedValueIndex < clickStandaloneDetailIndex, true);
assert.equal(clickStandaloneDetailIndex < verifyStandaloneIntentIndex, true);

console.log("report-builder-preview-runtime-chart-detail-parity-scenario-assets ✓ builder preview and standalone runtime resolve the same semantic detail target from chart interactions");
