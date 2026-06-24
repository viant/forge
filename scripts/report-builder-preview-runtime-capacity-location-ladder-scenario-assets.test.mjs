import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-capacity-location-ladder.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 16);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Location Ladder" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("CAPACITY LOCATION")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Region -> Metro Area")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Market")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected dimensions (1)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Categories Location, Metrics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Lineage harmonizer://feature/location")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Market')") && expression.includes("!labels.includes('Region')") && expression.includes("!labels.includes('Metro Area')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Region = US")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Region')") && expression.includes("!labels.includes('Market')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Metro Area = West")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("return labels.includes('Metro Area') && !labels.includes('Region')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("capacity-location-ladder")),
  true,
);

const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Location Ladder");
const presetTitleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("CAPACITY LOCATION"));
const semanticBindingIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic Binding"));
const startingHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Market')") && String(step?.expression || "").includes("!labels.includes('Region')") && String(step?.expression || "").includes("!labels.includes('Metro Area')"));
const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickRegionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Region");
const regionChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Region = US"));
const regionHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Region')") && String(step?.expression || "").includes("!labels.includes('Market')"));
const clickMetroIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Metro Area");
const metroChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Metro Area = West"));
const metroHeaderIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("return labels.includes('Metro Area') && !labels.includes('Region')"));

assert.notEqual(selectPresetIndex, -1);
assert.notEqual(presetTitleIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(startingHeaderIndex, -1);
assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickRegionIndex, -1);
assert.notEqual(regionChipIndex, -1);
assert.notEqual(regionHeaderIndex, -1);
assert.notEqual(clickMetroIndex, -1);
assert.notEqual(metroChipIndex, -1);
assert.notEqual(metroHeaderIndex, -1);

assert.equal(selectPresetIndex < presetTitleIndex, true);
assert.equal(presetTitleIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < startingHeaderIndex, true);
assert.equal(startingHeaderIndex < actionsReadyIndex, true);
assert.equal(actionsReadyIndex < clickRegionIndex, true);
assert.equal(clickRegionIndex < regionChipIndex, true);
assert.equal(regionChipIndex < regionHeaderIndex, true);
assert.equal(regionHeaderIndex < clickMetroIndex, true);
assert.equal(clickMetroIndex < metroChipIndex, true);
assert.equal(metroChipIndex < metroHeaderIndex, true);

console.log("report-builder-preview-runtime-capacity-location-ladder-scenario-assets ✓ location ladder starts on market and drills through region to metro area");
