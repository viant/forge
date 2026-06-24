import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-compact-chart-story.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 18);

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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Avails by Date and Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("CHART VIEW")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("VISUAL STORY")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Split by Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Trend View")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Full Query")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Delivery Date, Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Measures Available Impressions")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Compiled Report Runtime Preview") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("Measures Available Impressions") && expression.includes("Refine the current builder result through the compiled ReportDocument, ReportSpec, and ReportFill flow.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-compact-chart-story")),
  true,
);

const openCompactSheetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const quickPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.text || "").includes("Avails by Date and Channel"));
const compactChartViewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("CHART VIEW"));
const reopenCompactSheetIndex = scenario.steps.findIndex((step, index) => index > compactChartViewIndex && step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Chart"));
const compactIdentityIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("VISUAL STORY"));
const closeSheetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Close");
const authoredRuntimeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Authored Runtime"));
const runtimeSemanticBindingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Compiled Report Runtime Preview") && String(step.expression || "").includes("Semantic Binding"));

assert.notEqual(openCompactSheetIndex, -1);
assert.notEqual(quickPresetIndex, -1);
assert.notEqual(compactChartViewIndex, -1);
assert.notEqual(reopenCompactSheetIndex, -1);
assert.notEqual(compactIdentityIndex, -1);
assert.notEqual(closeSheetIndex, -1);
assert.notEqual(authoredRuntimeIndex, -1);
assert.notEqual(runtimeSemanticBindingIndex, -1);

assert.equal(openCompactSheetIndex < quickPresetIndex, true);
assert.equal(quickPresetIndex < compactChartViewIndex, true);
assert.equal(compactChartViewIndex < reopenCompactSheetIndex, true);
assert.equal(reopenCompactSheetIndex < compactIdentityIndex, true);
assert.equal(compactIdentityIndex < closeSheetIndex, true);
assert.equal(closeSheetIndex < authoredRuntimeIndex, true);
assert.equal(authoredRuntimeIndex < runtimeSemanticBindingIndex, true);

console.log("report-builder-preview-semantic-compact-chart-story-scenario-assets ✓ compact provider-backed chart story presets stay aligned with the compiled authored runtime semantic binding surface");
