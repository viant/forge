import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-error.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("age_group") && expression.includes("Semantic provider unavailable.")),
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
  scenario.steps.filter((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "agegroupId").length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("text.includes('Semantic validation: Semantic provider unavailable.')") && expression.includes("text.includes('Resolve semantic selection issues')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Semantic provider unavailable.")),
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
  expressions.some((expression) => expression.includes("!text.includes('Semantic validation: Semantic provider unavailable.')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__semanticErrorStaleValidationStartedAt = Date.now()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__semanticErrorStaleValidationInFlightAt = Date.now()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__semanticErrorStaleValidationBaseline") && expression.includes("validateSelectionCount") && expression.includes("behaviorCount")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("validateSelectionCount > baseline.validateSelectionCount") && expression.includes("remainingBehaviors < baseline.behaviorCount") && expression.includes("window.__semanticErrorStaleValidationInFlightAt = Date.now()")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Date.now() - (window.__semanticErrorStaleValidationInFlightAt || 0) >= 1800") && expression.includes("!text.includes('Semantic validation: Semantic provider unavailable.')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("!text.includes('Validating the semantic selection against the provider.')") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-error-proof")),
  true,
);

const injectErrorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceSemanticValidationBehaviors") && String(step.expression || "").includes("age_group") && String(step.expression || "").includes("delayMs\":1200"));
const openSettingsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings");
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const validatingOrErrorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Semantic validation: Semantic provider unavailable.')"));
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Semantic provider unavailable."));
const runDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("runButtons[0].disabled === true"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')") && String(step.expression || "").includes("runButtons[0].disabled === false"));
const injectStaleErrorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("delayMs\":1500"));
const staleStartedIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("window.__semanticErrorStaleValidationStartedAt = Date.now()"));
const staleBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__semanticErrorStaleValidationBaseline"));
const reselectAgeGroupIndex = scenario.steps.findIndex((step, index) => index > staleStartedIndex && step?.type === "selectSelector" && step?.value === "agegroupId");
const staleValidationStartedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("validateSelectionCount > baseline.validateSelectionCount") && String(step.expression || "").includes("remainingBehaviors < baseline.behaviorCount") && String(step.expression || "").includes("window.__semanticErrorStaleValidationInFlightAt = Date.now()"));
const staleClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Date.now() - (window.__semanticErrorStaleValidationInFlightAt || 0) >= 1800"));

assert.notEqual(injectErrorIndex, -1);
assert.notEqual(openSettingsIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(validatingOrErrorIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(runDisabledIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(injectStaleErrorIndex, -1);
assert.notEqual(staleStartedIndex, -1);
assert.notEqual(staleBaselineIndex, -1);
assert.notEqual(reselectAgeGroupIndex, -1);
assert.notEqual(staleValidationStartedIndex, -1);
assert.notEqual(staleClearedIndex, -1);

assert.equal(injectErrorIndex < openSettingsIndex, true);
assert.equal(openSettingsIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < validatingOrErrorIndex, true);
assert.equal(validatingOrErrorIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < runDisabledIndex, true);
assert.equal(runDisabledIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < recoveredIndex, true);
assert.equal(recoveredIndex < injectStaleErrorIndex, true);
assert.equal(injectStaleErrorIndex < staleStartedIndex, true);
assert.equal(staleStartedIndex < staleBaselineIndex, true);
assert.equal(staleBaselineIndex < reselectAgeGroupIndex, true);
assert.equal(reselectAgeGroupIndex < staleValidationStartedIndex, true);
assert.equal(staleValidationStartedIndex < staleClearedIndex, true);

console.log("report-builder-preview-error-scenario-assets ✓ provider-backed validation errors disable run, clear after correction, and stale delayed errors do not re-poison the active valid selection");
