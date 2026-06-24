import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-quick-view-delivery-grid.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 19);

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Tables")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Table-first grids for export-ready delivery and reach reporting.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Delivery Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected Dates")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Priority")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && String(step.text || "").includes("Delivery Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL")),
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
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel +1") && expression.includes("Measures Available Impressions, Household Uniques") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-quick-view-delivery-grid")),
  true,
);

const openQuickViewIndex = findStepIndex((step) => step?.type === "clickSelector" && String(step.selector || "").includes("forge-report-builder__chart-action-button--quick"));
const tablesSectionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Tables"));
const deliveryItemIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Delivery Grid"));
const reachItemIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Grid"));
const applyDeliveryIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && String(step.text || "").includes("Delivery Grid"));
const activeDeliveryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL"));
const runtimeBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(openQuickViewIndex, -1);
assert.notEqual(tablesSectionIndex, -1);
assert.notEqual(deliveryItemIndex, -1);
assert.notEqual(reachItemIndex, -1);
assert.notEqual(applyDeliveryIndex, -1);
assert.notEqual(activeDeliveryIndex, -1);
assert.notEqual(runtimeBindingIndex, -1);

assert.equal(openQuickViewIndex < tablesSectionIndex, true);
assert.equal(tablesSectionIndex < deliveryItemIndex, true);
assert.equal(deliveryItemIndex < reachItemIndex, true);
assert.equal(reachItemIndex < applyDeliveryIndex, true);
assert.equal(applyDeliveryIndex < activeDeliveryIndex, true);
assert.equal(activeDeliveryIndex < runtimeBindingIndex, true);

console.log("report-builder-preview-semantic-quick-view-delivery-grid-scenario-assets ✓ desktop quick-view delivery-grid stays provider-backed and flows into the compiled runtime semantic binding surface");
