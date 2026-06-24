import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-error-recovery-toggle-cache.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__reopenedChartDetailErrorRecoveryToggleCacheBaseline") && expression.includes('entry.type === "chartQuery"')),
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
  expressions.some((expression) => expression.includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("Resolved detail target")') && expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('preview?.["__reopenedChartDetailErrorRecoveryToggleCacheBaseline"]')),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-error-recovery-toggle-cache")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const resetBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__reopenedChartDetailErrorRecoveryToggleCacheBaseline"));
const failureClickIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show channel details");
const failureStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedChartDetailErrorRecoveryToggleCacheBaseline"]'));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const recoveryClickIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show channel details" && scenario.steps.indexOf(step) > clearBehaviorsIndex);
const toggleTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "table");
const toggleChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "chart");
const exportInspectIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened section."));

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(resetBaselineIndex, -1);
assert.notEqual(failureClickIndex, -1);
assert.notEqual(failureStableIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(recoveryClickIndex, -1);
assert.notEqual(toggleTableIndex, -1);
assert.notEqual(toggleChartIndex, -1);
assert.notEqual(exportInspectIndex, -1);

assert.equal(injectBehaviorIndex < resetBaselineIndex, true);
assert.equal(resetBaselineIndex < failureClickIndex, true);
assert.equal(failureClickIndex < failureStableIndex, true);
assert.equal(failureStableIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < recoveryClickIndex, true);
assert.equal(recoveryClickIndex < toggleTableIndex, true);
assert.equal(toggleTableIndex < toggleChartIndex, true);
assert.equal(toggleChartIndex < exportInspectIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-error-recovery-toggle-cache-scenario-assets ✓ reopened chart detail recovery preserves cache stability across recovery, toggles, and export inspection");
