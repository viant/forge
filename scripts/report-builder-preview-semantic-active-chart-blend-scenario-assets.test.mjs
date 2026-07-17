import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-active-chart-blend.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 13);

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Avails + HH Uniques by Date")),
  true,
);
assert.equal(
  ["KPI BLEND", "Dual Axis", "Reach + Volume", "Full Query"].every((text) => scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes(text))),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("forge-report-builder__chart-wrap") && expression.includes("forge-report-builder__result-header h3") && expression.includes("Avails + HH Uniques by Date")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Delivery Date")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Measures Available Impressions, Household Uniques")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date") && expression.includes("Measures Available Impressions, Household Uniques") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-active-chart-blend")),
  true,
);

const quickChartButtonIndex = findStepIndex((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick"));
const presetMetadataIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("KPI BLEND"));
const presetSelectIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Avails + HH Uniques by Date"));
const builderBlendIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-builder__chart-wrap") && String(step.expression || "").includes("Avails + HH Uniques by Date"));
const authoredRuntimeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime"));
const runtimeSemanticBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(quickChartButtonIndex, -1);
assert.notEqual(presetMetadataIndex, -1);
assert.notEqual(presetSelectIndex, -1);
assert.notEqual(builderBlendIndex, -1);
assert.notEqual(authoredRuntimeIndex, -1);
assert.notEqual(runtimeSemanticBindingIndex, -1);

assert.equal(quickChartButtonIndex < presetMetadataIndex, true);
assert.equal(presetMetadataIndex < presetSelectIndex, true);
assert.equal(presetSelectIndex < builderBlendIndex, true);
assert.equal(builderBlendIndex < authoredRuntimeIndex, true);
assert.equal(authoredRuntimeIndex < runtimeSemanticBindingIndex, true);

console.log("report-builder-preview-semantic-active-chart-blend-scenario-assets ✓ provider-backed KPI blend presets stay aligned with the compiled authored runtime semantic binding surface");
