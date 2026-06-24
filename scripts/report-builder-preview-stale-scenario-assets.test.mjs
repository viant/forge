import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-stale.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("age_group") && expression.includes("delayMs\":1500")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("BREAK DOWN BY")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__semanticStaleValidationBaseline") && expression.includes("validateSelectionCount") && expression.includes("behaviorCount")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "agegroupId"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("validateSelectionCount > baseline.validateSelectionCount") && expression.includes("remainingBehaviors < baseline.behaviorCount") && expression.includes("window.__semanticStaleValidationInFlightAt = Date.now()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("return text.includes('Validating the semantic selection against the provider.')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === ""),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Date.now() - (window.__semanticStaleValidationInFlightAt || 0) >= 1800") && expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("!text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.')") && expression.includes("!text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.')") && expression.includes("!text.includes('Validating the semantic selection against the provider.')") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-stale-proof")),
  true,
);

const injectStaleIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceSemanticValidationBehaviors") && String(step.expression || "").includes("delayMs\":1500"));
const openSettingsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings");
const staleBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__semanticStaleValidationBaseline"));
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const staleValidationStartedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("validateSelectionCount > baseline.validateSelectionCount") && String(step.expression || "").includes("window.__semanticStaleValidationInFlightAt = Date.now()") && String(step.expression || "").includes("return text.includes('Validating the semantic selection against the provider.')"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const staleIgnoredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Date.now() - (window.__semanticStaleValidationInFlightAt || 0) >= 1800"));

assert.notEqual(injectStaleIndex, -1);
assert.notEqual(openSettingsIndex, -1);
assert.notEqual(staleBaselineIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(staleValidationStartedIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(staleIgnoredIndex, -1);

assert.equal(injectStaleIndex < openSettingsIndex, true);
assert.equal(openSettingsIndex < staleBaselineIndex, true);
assert.equal(staleBaselineIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < staleValidationStartedIndex, true);
assert.equal(staleValidationStartedIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < staleIgnoredIndex, true);

console.log("report-builder-preview-stale-scenario-assets ✓ stale delayed semantic validation results are ignored once the active selection has been cleared");
