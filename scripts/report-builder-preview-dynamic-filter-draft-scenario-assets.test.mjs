import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-dynamic-filter-draft.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
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
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("dynamicFilterGroups") && expression.includes("scopeRules") && expression.includes("manualPlaceholder: 'National'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Scope Rules")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === "button" && step?.text === "Open Filters"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Scope Rules • available"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes('Local Draft')") && expression.includes("keys.some((key)") && expression.includes("Array.isArray(parsed?.dynamicGroups?.scopeRules)") && expression.includes("parsed.dynamicGroups.scopeRules.length === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("document.querySelector('input[placeholder=\"National\"]')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && step?.selector === "input[placeholder=\"National\"]" && step?.value === "Regional"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Add value"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.explorationSession?.dirty === true") && expression.includes("rows.length === 1") && expression.includes("entry?.value === 'Regional'") && expression.includes("entry?.label === 'Regional'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("dynamic-filter-draft")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("patchBuilderConfig"));
const scopeRulesVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Scope Rules"));
const openFiltersIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === "button" && step?.text === "Open Filters");
const openScopeRulesIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Scope Rules • available");
const noDraftBeforeValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Local Draft')") && String(step.expression || "").includes("keys.some((key)") && String(step.expression || "").includes("parsed.dynamicGroups.scopeRules.length === 1"));
const inputReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("input[placeholder=\"National\"]"));
const fillValueIndex = findStepIndex((step) => step?.type === "fillSelector" && step?.selector === "input[placeholder=\"National\"]");
const addValueIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Add value");
const localDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft"));
const persistedDraftIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.explorationSession?.dirty === true") && String(step.expression || "").includes("entry?.value === 'Regional'"));

assert.notEqual(patchConfigIndex, -1);
assert.notEqual(scopeRulesVisibleIndex, -1);
assert.notEqual(openFiltersIndex, -1);
assert.notEqual(openScopeRulesIndex, -1);
assert.notEqual(noDraftBeforeValueIndex, -1);
assert.notEqual(inputReadyIndex, -1);
assert.notEqual(fillValueIndex, -1);
assert.notEqual(addValueIndex, -1);
assert.notEqual(localDraftIndex, -1);
assert.notEqual(persistedDraftIndex, -1);

assert.equal(patchConfigIndex < scopeRulesVisibleIndex, true);
assert.equal(scopeRulesVisibleIndex < openFiltersIndex, true);
assert.equal(openFiltersIndex < openScopeRulesIndex, true);
assert.equal(openScopeRulesIndex < noDraftBeforeValueIndex, true);
assert.equal(noDraftBeforeValueIndex < inputReadyIndex, true);
assert.equal(inputReadyIndex < fillValueIndex, true);
assert.equal(fillValueIndex < addValueIndex, true);
assert.equal(addValueIndex < localDraftIndex, true);
assert.equal(localDraftIndex < persistedDraftIndex, true);

console.log("report-builder-preview-dynamic-filter-draft-scenario-assets ✓ dynamic filter rows can be configured before drafting and correctly promote into a dirty exploration draft once a value is added");
