import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-quick-view-chart-families.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 17);

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Chart Stories")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Narrative story charts for split trends and channel movement.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("KPI Blends")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Blended KPI charts for volume and reach comparisons.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails + HH Uniques by Date")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Split by Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dual Axis")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && String(step.text || "").includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Chart-first view for the active scope") && expression.includes("VISUAL STORY") && expression.includes("Split by Channel") && expression.includes("Trend View") && expression.includes("Full Query")),
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
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("Measures Available Impressions") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-quick-view-chart-families")),
  true,
);

const openQuickViewIndex = findStepIndex((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick"));
const chartStoriesIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Chart Stories"));
const blendsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("KPI Blends"));
const storyEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails by Date and Channel"));
const blendEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Avails + HH Uniques by Date"));
const applyStoryIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && String(step.text || "").includes("Avails by Date and Channel"));
const activeStoryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("VISUAL STORY") && String(step.expression || "").includes("Split by Channel"));
const runtimeBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(openQuickViewIndex, -1);
assert.notEqual(chartStoriesIndex, -1);
assert.notEqual(blendsIndex, -1);
assert.notEqual(storyEntryIndex, -1);
assert.notEqual(blendEntryIndex, -1);
assert.notEqual(applyStoryIndex, -1);
assert.notEqual(activeStoryIndex, -1);
assert.notEqual(runtimeBindingIndex, -1);

assert.equal(openQuickViewIndex < chartStoriesIndex, true);
assert.equal(chartStoriesIndex < blendsIndex, true);
assert.equal(blendsIndex < storyEntryIndex, true);
assert.equal(storyEntryIndex < blendEntryIndex, true);
assert.equal(blendEntryIndex < applyStoryIndex, true);
assert.equal(applyStoryIndex < activeStoryIndex, true);
assert.equal(activeStoryIndex < runtimeBindingIndex, true);

console.log("report-builder-preview-semantic-quick-view-chart-families-scenario-assets ✓ desktop quick-view chart families stay provider-backed and flow into the compiled runtime semantic binding surface");
