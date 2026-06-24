import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-success.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("country_code") && expression.includes("valid: true")),
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
  scenario.steps.filter((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "country").length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === ""),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__semanticSuccessStaleValidationStartedAt = Date.now()") && expression.includes("delayMs: 1500")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "agegroupId"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Audience Age Group is not supported for this semantic selection in the demo provider.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Date.now() - (window.__semanticSuccessStaleValidationStartedAt || 0) >= 1800") && expression.includes("text.includes('Resolve semantic selection issues')") && expression.includes("text.includes('Audience Age Group is not supported for this semantic selection in the demo provider.')") && expression.includes("text.includes('Household Uniques cannot be combined with Audience Age Group in this demo semantic provider.')") && expression.includes("runButtons[0].disabled === true")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-success-proof")),
  true,
);

const injectSuccessIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceSemanticValidationBehaviors") && String(step.expression || "").includes("country_code") && String(step.expression || "").includes("delayMs\":1200") && String(step.expression || "").includes("valid\":true"));
const openSettingsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings");
const selectCountryIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "country");
const firstSettledSuccessIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Validating the semantic selection against the provider.')") && String(step.expression || "").includes("runButtons[0].disabled === false"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const injectStaleSuccessIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("__semanticSuccessStaleValidationStartedAt = Date.now()"));
const reselectCountryIndex = scenario.steps.findIndex((step, index) => index > injectStaleSuccessIndex && step?.type === "selectSelector" && step?.value === "country");
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const invalidVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Audience Age Group is not supported for this semantic selection in the demo provider."));
const staleSuccessRejectedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Date.now() - (window.__semanticSuccessStaleValidationStartedAt || 0) >= 1800") && String(step.expression || "").includes("runButtons[0].disabled === true"));

assert.notEqual(injectSuccessIndex, -1);
assert.notEqual(openSettingsIndex, -1);
assert.notEqual(selectCountryIndex, -1);
assert.notEqual(firstSettledSuccessIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(injectStaleSuccessIndex, -1);
assert.notEqual(reselectCountryIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(invalidVisibleIndex, -1);
assert.notEqual(staleSuccessRejectedIndex, -1);

assert.equal(injectSuccessIndex < openSettingsIndex, true);
assert.equal(openSettingsIndex < selectCountryIndex, true);
assert.equal(selectCountryIndex < firstSettledSuccessIndex, true);
assert.equal(firstSettledSuccessIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < injectStaleSuccessIndex, true);
assert.equal(injectStaleSuccessIndex < reselectCountryIndex, true);
assert.equal(reselectCountryIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < invalidVisibleIndex, true);
assert.equal(invalidVisibleIndex < staleSuccessRejectedIndex, true);

console.log("report-builder-preview-success-scenario-assets ✓ provider-backed success clears run gating, while a later incompatible active selection still wins over delayed stale success");
