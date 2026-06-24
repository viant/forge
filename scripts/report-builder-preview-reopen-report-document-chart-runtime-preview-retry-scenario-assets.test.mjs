import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-runtime-preview-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__reopenedRuntimePreviewRetryBaseline") && expression.includes("runtimePreview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail") && expression.includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-runtime-preview-retry")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const baselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__reopenedRuntimePreviewRetryBaseline"));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const secondRunIndex = scenario.steps.findIndex((step, index) => index > firstRunIndex && step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const chartClickIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes(".forge-chart-legend-action"));
const resolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("target://example/performance/channel-detail") && String(step?.expression || "").includes("Display"));

assert.notEqual(reopenIndex, -1);
assert.notEqual(baselineIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(chartClickIndex, -1);
assert.notEqual(resolvedIndex, -1);

assert.equal(reopenIndex < baselineIndex, true);
assert.equal(baselineIndex < firstRunIndex, true);
assert.equal(firstRunIndex < secondRunIndex, true);
assert.equal(secondRunIndex < chartClickIndex, true);
assert.equal(chartClickIndex < resolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-runtime-preview-retry-scenario-assets ✓ reopened chart runtime preview retry restores the runtime surface after rerun");
