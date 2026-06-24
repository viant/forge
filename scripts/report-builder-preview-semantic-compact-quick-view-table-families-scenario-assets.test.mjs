import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-compact-quick-view-table-families.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create or apply a chart")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Showing Delivery Grid.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Close"),
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
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel +1") && expression.includes("Measures Available Impressions, Household Uniques")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-compact-quick-view-table-families")),
  true,
);

const openCompactSheetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const tablesSectionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Tables"));
const deliveryItemIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Delivery Grid"));
const reachItemIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach Grid"));
const applyDeliveryIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && String(step.text || "").includes("Delivery Grid"));
const compactSummaryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Showing Delivery Grid."));
const reopenSheetIndex = scenario.steps.findIndex((step, index) => index > compactSummaryIndex && step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const compactIdentityIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL"));
const closeSheetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Close");
const runtimeBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(openCompactSheetIndex, -1);
assert.notEqual(tablesSectionIndex, -1);
assert.notEqual(deliveryItemIndex, -1);
assert.notEqual(reachItemIndex, -1);
assert.notEqual(applyDeliveryIndex, -1);
assert.notEqual(compactSummaryIndex, -1);
assert.notEqual(reopenSheetIndex, -1);
assert.notEqual(compactIdentityIndex, -1);
assert.notEqual(closeSheetIndex, -1);
assert.notEqual(runtimeBindingIndex, -1);

assert.equal(openCompactSheetIndex < tablesSectionIndex, true);
assert.equal(tablesSectionIndex < deliveryItemIndex, true);
assert.equal(deliveryItemIndex < reachItemIndex, true);
assert.equal(reachItemIndex < applyDeliveryIndex, true);
assert.equal(applyDeliveryIndex < compactSummaryIndex, true);
assert.equal(compactSummaryIndex < reopenSheetIndex, true);
assert.equal(reopenSheetIndex < compactIdentityIndex, true);
assert.equal(compactIdentityIndex < closeSheetIndex, true);
assert.equal(closeSheetIndex < runtimeBindingIndex, true);

console.log("report-builder-preview-semantic-compact-quick-view-table-families-scenario-assets ✓ compact quick-view table families stay provider-backed and flow into the compiled runtime semantic binding surface");
