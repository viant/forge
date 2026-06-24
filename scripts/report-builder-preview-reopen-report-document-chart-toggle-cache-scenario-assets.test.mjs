import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-toggle-cache.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__reopenedChartToggleCacheBaseline") && expression.includes('entry.type === "chartQuery"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Avails by Date and Channel") && expression.includes("binding?.mode === 'semantic'")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Table view for the active scope.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-toggle-cache")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const resetBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__reopenedChartToggleCacheBaseline"));
const toggleTableIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "table");
const toggleChartIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__result-header .forge-report-builder__view-toggle button" && step?.text === "chart");
const finalStableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('preview?.["__reopenedChartToggleCacheBaseline"]'));

assert.notEqual(reopenIndex, -1);
assert.notEqual(resetBaselineIndex, -1);
assert.notEqual(toggleTableIndex, -1);
assert.notEqual(toggleChartIndex, -1);
assert.notEqual(finalStableIndex, -1);

assert.equal(reopenIndex < resetBaselineIndex, true);
assert.equal(resetBaselineIndex < toggleTableIndex, true);
assert.equal(toggleTableIndex < toggleChartIndex, true);
assert.equal(toggleChartIndex < finalStableIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-toggle-cache-scenario-assets ✓ reopened chart toggle-cache preserves chart/table runtime stability");
