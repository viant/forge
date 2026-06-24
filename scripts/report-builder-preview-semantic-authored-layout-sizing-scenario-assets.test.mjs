import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-layout-sizing.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 10);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Apply template"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Market Brief"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Market Brief applied.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Market Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titles.includes('Executive Summary')") && expression.includes("titles.includes('Headline KPI')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('data-report-document-block-id="narrativeIntro"') && expression.includes("Half width button not found for narrative block.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Executive Summary resized to half width in the authored report layout.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("blockId === 'narrativeIntro'") && expression.includes("item?.size === 'half'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('data-report-runtime-block-id="narrativeIntro"') && expression.includes('data-report-runtime-layout-size="half"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-authored-layout-sizing")),
  true,
);

const applyTemplateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply template");
const selectTemplateIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Market Brief");
const appliedNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Market Brief applied."));
const seededNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Seeded from template: Market Brief"));
const titlesIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles.includes('Executive Summary')"));
const resizeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes('data-report-document-block-id="narrativeIntro"') && String(step.expression || "").includes("Half width button not found for narrative block."));
const resizedNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Executive Summary resized to half width in the authored report layout."));
const stateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("blockId === 'narrativeIntro'") && String(step.expression || "").includes("item?.size === 'half'"));
const runtimeLayoutIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('data-report-runtime-block-id="narrativeIntro"') && String(step.expression || "").includes('data-report-runtime-layout-size="half"'));

assert.notEqual(applyTemplateIndex, -1);
assert.notEqual(selectTemplateIndex, -1);
assert.notEqual(appliedNoticeIndex, -1);
assert.notEqual(seededNoticeIndex, -1);
assert.notEqual(titlesIndex, -1);
assert.notEqual(resizeIndex, -1);
assert.notEqual(resizedNoticeIndex, -1);
assert.notEqual(stateIndex, -1);
assert.notEqual(runtimeLayoutIndex, -1);

assert.equal(applyTemplateIndex < selectTemplateIndex, true);
assert.equal(selectTemplateIndex < appliedNoticeIndex, true);
assert.equal(appliedNoticeIndex < seededNoticeIndex, true);
assert.equal(seededNoticeIndex < titlesIndex, true);
assert.equal(titlesIndex < resizeIndex, true);
assert.equal(resizeIndex < resizedNoticeIndex, true);
assert.equal(resizedNoticeIndex < stateIndex, true);
assert.equal(stateIndex < runtimeLayoutIndex, true);

console.log("report-builder-preview-semantic-authored-layout-sizing-scenario-assets ✓ Market Brief authored layout resizing updates both builder layout state and runtime block sizing");
