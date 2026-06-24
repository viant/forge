import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-desktop.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Performance metrics settings"),
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
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Audience Age Group is not supported for this semantic selection in the demo provider.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Resolve semantic selection issues")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("runButtons.length === 1") && expression.includes("runButtons[0].disabled === true")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === ""),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("!text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.')") && expression.includes("!text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.')") && expression.includes("runButtons.length === 1") && expression.includes("runButtons[0].disabled === false")),
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
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-desktop-proof")),
  true,
);

const openSettingsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Performance metrics settings");
const breakdownIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("BREAK DOWN BY"));
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const invalidVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const runDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("runButtons[0].disabled === true"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Semantic provider diagnostics')") && String(step.expression || "").includes("runButtons[0].disabled === false"));
const bindingVisibleIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));

assert.notEqual(openSettingsIndex, -1);
assert.notEqual(breakdownIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(invalidVisibleIndex, -1);
assert.notEqual(runDisabledIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(bindingVisibleIndex, -1);

assert.equal(openSettingsIndex < breakdownIndex, true);
assert.equal(breakdownIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < invalidVisibleIndex, true);
assert.equal(invalidVisibleIndex < runDisabledIndex, true);
assert.equal(runDisabledIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < recoveredIndex, true);
assert.equal(recoveredIndex < bindingVisibleIndex, true);

console.log("report-builder-preview-semantic-desktop-scenario-assets ✓ desktop semantic selections surface provider diagnostics and recover cleanly after clearing the unsupported breakdown");
