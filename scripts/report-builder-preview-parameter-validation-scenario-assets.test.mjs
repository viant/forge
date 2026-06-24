import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-parameter-validation.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Date Range")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("dateRange: { start: '2026-05-07', end: '2026-05-01' }")),
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
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Date Range start date must be on or before the end date.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("selection.parameters.reporting_window")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Resolve semantic selection issues")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__panel--date-range.is-semantic-provider-invalid") && expression.includes("Date Range start date must be on or before the end date.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("runButtons.length === 1") && expression.includes("runButtons[0].disabled === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("dateRange: { start: '2026-05-01', end: '2026-05-04' }")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Validating the semantic selection against the provider.')") && expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("!text.includes('Date Range start date must be on or before the end date.')") && expression.includes("!text.includes('selection.parameters.reporting_window')") && expression.includes("!text.includes('Resolve semantic selection issues')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes('Semantic provider diagnostics')") && expression.includes("!text.includes('Date Range start date must be on or before the end date.')") && expression.includes("!text.includes('selection.parameters.reporting_window')") && expression.includes("!text.includes('Resolve semantic selection issues')") && expression.includes("!panel.classList.contains('is-semantic-provider-invalid')") && expression.includes("runButtons[0].disabled === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("parameter-validation-proof")),
  true,
);

const invalidPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("dateRange: { start: '2026-05-07', end: '2026-05-01' }"));
const invalidValidationOrSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Validating the semantic selection against the provider.')") && String(step.expression || "").includes("text.includes('Semantic provider diagnostics')"));
const diagnosticsVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const runDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("runButtons[0].disabled === true"));
const validPatchIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("dateRange: { start: '2026-05-01', end: '2026-05-04' }"));
const recoveryValidationOrSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Validating the semantic selection against the provider.')") && String(step.expression || "").includes("!text.includes('Semantic provider diagnostics')"));
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Semantic provider diagnostics')") && String(step.expression || "").includes("runButtons[0].disabled === false"));

assert.notEqual(invalidPatchIndex, -1);
assert.notEqual(invalidValidationOrSettledIndex, -1);
assert.notEqual(diagnosticsVisibleIndex, -1);
assert.notEqual(runDisabledIndex, -1);
assert.notEqual(validPatchIndex, -1);
assert.notEqual(recoveryValidationOrSettledIndex, -1);
assert.notEqual(recoveredIndex, -1);

assert.equal(invalidPatchIndex < invalidValidationOrSettledIndex, true);
assert.equal(invalidValidationOrSettledIndex < diagnosticsVisibleIndex, true);
assert.equal(diagnosticsVisibleIndex < runDisabledIndex, true);
assert.equal(runDisabledIndex < validPatchIndex, true);
assert.equal(validPatchIndex < recoveryValidationOrSettledIndex, true);
assert.equal(recoveryValidationOrSettledIndex < recoveredIndex, true);

console.log("report-builder-preview-parameter-validation-scenario-assets ✓ provider-backed semantic parameter validation blocks invalid range execution and clears cleanly after correction");
