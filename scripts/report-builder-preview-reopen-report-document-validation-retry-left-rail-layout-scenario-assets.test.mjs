import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-validation-retry-left-rail-layout.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("drillPanel.scrollWidth <= drillPanel.clientWidth + 1") && expression.includes("insideBounds") && expression.includes("Select at least two breakdowns to capture a drill path.") && expression.includes("Semantic validation: Semantic provider unavailable.") && expression.includes("Retry validation")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("!bodyText.includes(\"Semantic validation: Semantic provider unavailable.\")") && expression.includes("!bodyText.includes(\"Retry validation\")") && expression.includes("Measures Available Impressions, Household Uniques")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("validation-retry-left-rail-layout")),
  true,
);

const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const preRecoveryRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const preRecoveryRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Semantic validation: Semantic provider unavailable.") && String(step?.expression || "").includes("Select at least two breakdowns to capture a drill path."));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));
const postRecoveryRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!bodyText.includes(\"Semantic validation: Semantic provider unavailable.\")") && String(step?.expression || "").includes("Measures Available Impressions, Household Uniques"));

assert.notEqual(validationErrorIndex, -1);
assert.notEqual(preRecoveryRailIndex, -1);
assert.notEqual(preRecoveryRailSettledIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(postRecoveryRailSettledIndex, -1);

assert.equal(validationErrorIndex < preRecoveryRailIndex, true);
assert.equal(preRecoveryRailIndex < preRecoveryRailSettledIndex, true);
assert.equal(preRecoveryRailSettledIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);
assert.equal(recoveredIndex < postRecoveryRailSettledIndex, true);

console.log("report-builder-preview-reopen-report-document-validation-retry-left-rail-layout-scenario-assets ✓ reopened semantic validation retry keeps runtime semantic metadata visible under a narrowed setup rail before and after recovery");
