import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-active-delivery-grid.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 15);

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Delivery Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Delivery Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected Dates")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Market Context")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export Ready")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Delivery Date, Channel +1")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Measures Available Impressions, Household Uniques")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel +1") && expression.includes("Measures Available Impressions, Household Uniques") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-active-delivery-grid")),
  true,
);

const quickChartButtonIndex = findStepIndex((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick"));
const presetSelectIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Delivery Grid"));
const builderGridIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL"));
const authoredRuntimeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime"));
const runtimeSemanticBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(quickChartButtonIndex, -1);
assert.notEqual(presetSelectIndex, -1);
assert.notEqual(builderGridIndex, -1);
assert.notEqual(authoredRuntimeIndex, -1);
assert.notEqual(runtimeSemanticBindingIndex, -1);

assert.equal(quickChartButtonIndex < presetSelectIndex, true);
assert.equal(presetSelectIndex < builderGridIndex, true);
assert.equal(builderGridIndex < authoredRuntimeIndex, true);
assert.equal(authoredRuntimeIndex < runtimeSemanticBindingIndex, true);

console.log("report-builder-preview-semantic-active-delivery-grid-scenario-assets ✓ provider-backed delivery-grid presets stay aligned with the compiled authored runtime semantic binding surface");
