import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-recovery.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Setup")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("BREAK DOWN BY")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "agegroupId"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("text.includes('Semantic provider diagnostics')") && expression.includes("text.includes('Resolve semantic selection issues')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === ""),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("!text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.')") && expression.includes("!text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.')") && expression.includes("runButtons.length >= 2") && expression.includes("runButtons.every((button) => button.disabled === false)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Semantic provider diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Resolve semantic selection issues")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Audience Age Group is not supported for this semantic selection in the demo provider.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-recovery-proof")),
  true,
);

const openSetupIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Setup"));
const breakdownIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("BREAK DOWN BY"));
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const invalidVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Semantic provider diagnostics')") && String(step.expression || "").includes("runButtons.length >= 2") && String(step.expression || "").includes("runButtons.every((button) => button.disabled === false)"));
const bindingVisibleIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));

assert.notEqual(openSetupIndex, -1);
assert.notEqual(breakdownIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(invalidVisibleIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(bindingVisibleIndex, -1);

assert.equal(openSetupIndex < breakdownIndex, true);
assert.equal(breakdownIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < invalidVisibleIndex, true);
assert.equal(invalidVisibleIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < recoveredIndex, true);
assert.equal(recoveredIndex < bindingVisibleIndex, true);

console.log("report-builder-preview-semantic-recovery-scenario-assets ✓ compact invalid semantic selections recover cleanly after clearing the unsupported breakdown");
