import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-invalid.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 390,
  height: 844,
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
  expressions.some((expression) => expression.includes("runButtons.length >= 2") && expression.includes("runButtons.every((button) => button.disabled === true)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-invalid-proof")),
  true,
);

const openSetupIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && String(step.selector || "").includes("forge-report-builder__compact-action") && String(step.text || "").includes("Setup"));
const breakdownIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("BREAK DOWN BY"));
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const validatingOrSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Validating the semantic selection against the provider.')") && String(step.expression || "").includes("text.includes('Semantic provider diagnostics')"));
const diagnosticsVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const runDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("runButtons.length >= 2") && String(step.expression || "").includes("runButtons.every((button) => button.disabled === true)"));

assert.notEqual(openSetupIndex, -1);
assert.notEqual(breakdownIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(validatingOrSettledIndex, -1);
assert.notEqual(diagnosticsVisibleIndex, -1);
assert.notEqual(runDisabledIndex, -1);

assert.equal(openSetupIndex < breakdownIndex, true);
assert.equal(breakdownIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < validatingOrSettledIndex, true);
assert.equal(validatingOrSettledIndex < diagnosticsVisibleIndex, true);
assert.equal(diagnosticsVisibleIndex < runDisabledIndex, true);

console.log("report-builder-preview-semantic-invalid-scenario-assets ✓ compact invalid semantic selections surface provider diagnostics and disable all run actions");
