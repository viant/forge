import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-detail-error-recovery-export-request.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__reopenedInventoryChartDetailRecoveryExportBaseline") && expression.includes('entry.type === "chartQuery"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Inventory Top Channels Q3 for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.') && expression.includes('!text.includes("Resolved detail target")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('detailTargetBehaviors.length === 0')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("Resolved detail target")') && expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")') && expression.includes('!text.includes("Detail target resolution failed.")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') && expression.includes("!= null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "eval" && String(step.expression || "").includes("Runtime preview row for CTV not found.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("inventory-chart-detail-error-recovery-export-request")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const resetBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__reopenedInventoryChartDetailRecoveryExportBaseline"));
const failureClickIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show channel details" && step?.index === 0);
const failureStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedInventoryChartDetailRecoveryExportBaseline"]'));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const recoveryClickIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Runtime preview row for CTV not found."));
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("Resolved detail target")') && String(step?.expression || "").includes('text.includes("CTV")'));
const exportStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedInventoryChartDetailRecoveryExportBaseline"]') && scenario.steps.indexOf(step) > recoveryResolvedIndex);

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(resetBaselineIndex, -1);
assert.notEqual(failureClickIndex, -1);
assert.notEqual(failureStableIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(recoveryClickIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);
assert.notEqual(exportStableIndex, -1);

assert.equal(injectBehaviorIndex < resetBaselineIndex, true);
assert.equal(resetBaselineIndex < failureClickIndex, true);
assert.equal(failureClickIndex < failureStableIndex, true);
assert.equal(failureStableIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < recoveryClickIndex, true);
assert.equal(recoveryClickIndex < recoveryResolvedIndex, true);
assert.equal(recoveryResolvedIndex < exportStableIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-detail-error-recovery-export-request-scenario-assets ✓ reopened inventory chart detail failure and recovery preserve runtime/export stability");
