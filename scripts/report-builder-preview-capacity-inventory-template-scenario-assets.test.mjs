import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-capacity-inventory-template.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 8);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Apply template"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Capacity Inventory Brief"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Inventory Brief applied.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportDocumentTitle === 'Capacity Inventory Brief'") && expression.includes("dimensions.length === 1") && expression.includes("measures.length === 3") && expression.includes("state?.primaryMeasure === 'avails'") && expression.includes("state?.chartSpec?.title === 'Inventory by Channel'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titles.includes('Active Drill Path')") && expression.includes("titles.includes('Inventory Outlook')") && expression.includes("titles.includes('Top Channel KPI')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('data-report-runtime-block-id="narrativeIntro"') && expression.includes('data-report-runtime-block-id="headlineKpi"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("capacity-inventory-template")),
  true,
);

const applyTemplateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply template");
const selectTemplateIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Capacity Inventory Brief");
const appliedNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Capacity Inventory Brief applied."));
const seededNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Seeded from template: Capacity Inventory Brief"));
const stateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("reportDocumentTitle === 'Capacity Inventory Brief'"));
const titlesIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("titles.includes('Active Drill Path')"));
const runtimeLayoutIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('data-report-runtime-block-id="narrativeIntro"'));

assert.notEqual(applyTemplateIndex, -1);
assert.notEqual(selectTemplateIndex, -1);
assert.notEqual(appliedNoticeIndex, -1);
assert.notEqual(seededNoticeIndex, -1);
assert.notEqual(stateIndex, -1);
assert.notEqual(titlesIndex, -1);
assert.notEqual(runtimeLayoutIndex, -1);

assert.equal(applyTemplateIndex < selectTemplateIndex, true);
assert.equal(selectTemplateIndex < appliedNoticeIndex, true);
assert.equal(appliedNoticeIndex < seededNoticeIndex, true);
assert.equal(seededNoticeIndex < stateIndex, true);
assert.equal(stateIndex < titlesIndex, true);
assert.equal(titlesIndex < runtimeLayoutIndex, true);

console.log("report-builder-preview-capacity-inventory-template-scenario-assets ✓ applying the capacity inventory template seeds the expected semantic builder state and runtime layout");
