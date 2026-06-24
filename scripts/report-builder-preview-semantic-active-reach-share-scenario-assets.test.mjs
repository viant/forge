import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-active-reach-share.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 11);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Reach Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Grid")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Showing Reach Grid.") && expression.includes("HOUSEHOLD METRICS") && expression.includes("Reach Priority")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reach Share") && expression.includes("13.4%")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Compiled Report Runtime Preview")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Household Uniques") && expression.includes("Market") && expression.includes("Channel") && expression.includes("Delivery Date") && expression.includes("Reach Share") && expression.includes("13.4%") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-active-reach-share")),
  true,
);

const quickChartButtonIndex = findStepIndex((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick"));
const presetSelectIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Reach Grid"));
const builderReachIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Showing Reach Grid.") && String(step.expression || "").includes("Reach Priority"));
const reachShareValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Reach Share") && String(step.expression || "").includes("13.4%"));
const authoredRuntimeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime"));
const runtimeSemanticBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(quickChartButtonIndex, -1);
assert.notEqual(presetSelectIndex, -1);
assert.notEqual(builderReachIndex, -1);
assert.notEqual(reachShareValueIndex, -1);
assert.notEqual(authoredRuntimeIndex, -1);
assert.notEqual(runtimeSemanticBindingIndex, -1);

assert.equal(quickChartButtonIndex < presetSelectIndex, true);
assert.equal(presetSelectIndex < builderReachIndex, true);
assert.equal(builderReachIndex < reachShareValueIndex, true);
assert.equal(reachShareValueIndex < authoredRuntimeIndex, true);
assert.equal(authoredRuntimeIndex < runtimeSemanticBindingIndex, true);

console.log("report-builder-preview-semantic-active-reach-share-scenario-assets ✓ provider-backed reach-share tables stay aligned with the compiled authored runtime semantic binding surface");
