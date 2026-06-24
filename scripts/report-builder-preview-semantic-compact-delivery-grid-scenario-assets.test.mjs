import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-compact-delivery-grid.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Delivery Grid")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Delivery Grid")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-compact-delivery-grid")),
  true,
);

const openCompactSheetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const quickPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Delivery Grid"));
const compactSummaryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Showing Delivery Grid."));
const reopenCompactSheetIndex = scenario.steps.findIndex((step, index) => index > compactSummaryIndex && step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const compactIdentityIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("METRICS PANEL"));
const closeSheetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Close");
const authoredRuntimeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime"));
const runtimeSemanticBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(openCompactSheetIndex, -1);
assert.notEqual(quickPresetIndex, -1);
assert.notEqual(compactSummaryIndex, -1);
assert.notEqual(reopenCompactSheetIndex, -1);
assert.notEqual(compactIdentityIndex, -1);
assert.notEqual(closeSheetIndex, -1);
assert.notEqual(authoredRuntimeIndex, -1);
assert.notEqual(runtimeSemanticBindingIndex, -1);

assert.equal(openCompactSheetIndex < quickPresetIndex, true);
assert.equal(quickPresetIndex < compactSummaryIndex, true);
assert.equal(compactSummaryIndex < reopenCompactSheetIndex, true);
assert.equal(reopenCompactSheetIndex < compactIdentityIndex, true);
assert.equal(compactIdentityIndex < closeSheetIndex, true);
assert.equal(closeSheetIndex < authoredRuntimeIndex, true);
assert.equal(authoredRuntimeIndex < runtimeSemanticBindingIndex, true);

console.log("report-builder-preview-semantic-compact-delivery-grid-scenario-assets ✓ compact provider-backed delivery-grid presets stay aligned with the compiled authored runtime semantic binding surface");
