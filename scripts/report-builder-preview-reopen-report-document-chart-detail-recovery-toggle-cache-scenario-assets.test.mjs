import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-recovery-toggle-cache.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("detailTarget: null")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__reopenedChartDetailRecoveryToggleCacheBaseline") && expression.includes('entry.type === "chartQuery"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearDetailTargetBehaviors API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("Detail target resolved with omitted parameters:")') && expression.includes('text.includes("Display")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('preview?.["__reopenedChartDetailRecoveryToggleCacheBaseline"]')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "table"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "chart"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-recovery-toggle-cache")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detailTarget: null"));
const resetBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__reopenedChartDetailRecoveryToggleCacheBaseline"));
const displayLegendIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-chart-legend-action" && step?.text === "Display");
const firstStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedChartDetailRecoveryToggleCacheBaseline"]'));
const clearBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const ctvLegendIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-chart-legend-action" && step?.text === "CTV");
const toggleTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "table");
const toggleChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "chart");
const finalStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedChartDetailRecoveryToggleCacheBaseline"]') && scenario.steps.indexOf(step) > toggleChartIndex);

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(resetBaselineIndex, -1);
assert.notEqual(displayLegendIndex, -1);
assert.notEqual(firstStableIndex, -1);
assert.notEqual(clearBehaviorIndex, -1);
assert.notEqual(ctvLegendIndex, -1);
assert.notEqual(toggleTableIndex, -1);
assert.notEqual(toggleChartIndex, -1);
assert.notEqual(finalStableIndex, -1);

assert.equal(injectBehaviorIndex < resetBaselineIndex, true);
assert.equal(resetBaselineIndex < displayLegendIndex, true);
assert.equal(displayLegendIndex < firstStableIndex, true);
assert.equal(firstStableIndex < clearBehaviorIndex, true);
assert.equal(clearBehaviorIndex < ctvLegendIndex, true);
assert.equal(ctvLegendIndex < toggleTableIndex, true);
assert.equal(toggleTableIndex < toggleChartIndex, true);
assert.equal(toggleChartIndex < finalStableIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-recovery-toggle-cache-scenario-assets ✓ reopened chart detail recovery preserves cache stability across recovery and view toggles");
