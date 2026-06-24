import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-capacity-inventory-ladder.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 14);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Inventory Ladder" && step?.index === 0),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("CAPACITY INVENTORY")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Publisher -> Site Type")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Channel")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Channel')") && expression.includes("!labels.includes('Publisher')") && expression.includes("!labels.includes('Site Type')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Publisher = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("return labels.includes('Publisher') && !labels.includes('Channel')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Site Type = Acme Media")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("return labels.includes('Site Type') && !labels.includes('Publisher')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("capacity-inventory-ladder")),
  true,
);

const selectPresetIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "[role=\"menuitem\"]" && step?.text === "Inventory Ladder");
const presetTitleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("CAPACITY INVENTORY"));
const semanticBindingIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic Binding"));
const startingHeaderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("labels.includes('Channel')") && String(step?.expression || "").includes("!labels.includes('Publisher')"));
const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickPublisherIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Publisher");
const publisherChipIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Publisher = Display"));
const publisherHeaderIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("return labels.includes('Publisher') && !labels.includes('Channel')"));
const clickSiteTypeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Site Type");
const siteTypeChipIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Site Type = Acme Media"));
const siteTypeHeaderIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("return labels.includes('Site Type') && !labels.includes('Publisher')"));

assert.notEqual(selectPresetIndex, -1);
assert.notEqual(presetTitleIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(startingHeaderIndex, -1);
assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickPublisherIndex, -1);
assert.notEqual(publisherChipIndex, -1);
assert.notEqual(publisherHeaderIndex, -1);
assert.notEqual(clickSiteTypeIndex, -1);
assert.notEqual(siteTypeChipIndex, -1);
assert.notEqual(siteTypeHeaderIndex, -1);

assert.equal(selectPresetIndex < presetTitleIndex, true);
assert.equal(presetTitleIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < startingHeaderIndex, true);
assert.equal(startingHeaderIndex < actionsReadyIndex, true);
assert.equal(actionsReadyIndex < clickPublisherIndex, true);
assert.equal(clickPublisherIndex < publisherChipIndex, true);
assert.equal(publisherChipIndex < publisherHeaderIndex, true);
assert.equal(publisherHeaderIndex < clickSiteTypeIndex, true);
assert.equal(clickSiteTypeIndex < siteTypeChipIndex, true);
assert.equal(siteTypeChipIndex < siteTypeHeaderIndex, true);

console.log("report-builder-preview-runtime-capacity-inventory-ladder-scenario-assets ✓ inventory ladder starts on channel and drills through publisher to site type");
