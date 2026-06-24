import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-runtime-preview-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__inventoryChartRuntimeRetryBaseline") && expression.includes("runtimePreview")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__inventoryChartDrillSuccessBaseline")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__inventoryChartSecondDrillSuccessBaseline")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Publisher = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Site Type = Acme Media")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("inventory-chart-runtime-preview-retry")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const retryBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__inventoryChartRuntimeRetryBaseline"));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const secondRunIndex = scenario.steps.findIndex((step, index) => index > firstRunIndex && step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const firstDrillBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__inventoryChartDrillSuccessBaseline"));
const secondDrillBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__inventoryChartSecondDrillSuccessBaseline"));
const firstDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Publisher");
const secondDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Site Type");

assert.notEqual(reopenIndex, -1);
assert.notEqual(retryBaselineIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(firstDrillBaselineIndex, -1);
assert.notEqual(secondDrillBaselineIndex, -1);
assert.notEqual(firstDrillIndex, -1);
assert.notEqual(secondDrillIndex, -1);

assert.equal(reopenIndex < retryBaselineIndex, true);
assert.equal(retryBaselineIndex < firstRunIndex, true);
assert.equal(firstRunIndex < secondRunIndex, true);
assert.equal(secondRunIndex < firstDrillBaselineIndex, true);
assert.equal(firstDrillBaselineIndex < firstDrillIndex, true);
assert.equal(firstDrillIndex < secondDrillBaselineIndex, true);
assert.equal(secondDrillBaselineIndex < secondDrillIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-runtime-preview-retry-scenario-assets ✓ reopened inventory chart runtime preview retry restores preview and supports successive drill retries");
