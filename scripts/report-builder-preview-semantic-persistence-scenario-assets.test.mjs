import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-persistence.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 720,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 26);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.filter((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Performance metrics settings").length >= 3,
  true,
);
assert.equal(
  scenario.steps.filter((step) => step?.type === "reload").length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select" && step?.index === 0 && step?.value === "agegroupId"),
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
  expressions.some((expression) => expression.includes("document.querySelectorAll('select')[0]?.value === 'agegroupId'")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
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
  expressions.some((expression) => expression.includes("document.querySelectorAll('select')[0]?.value === ''")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("semantic-persistence-proof")),
  true,
);

const openSettingsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Performance metrics settings");
const selectAgeGroupIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "agegroupId");
const firstDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const firstReloadIndex = scenario.steps.findIndex((step, index) => index > firstDiagnosticsIndex && step?.type === "reload");
const reloadedDiagnosticsIndex = scenario.steps.findIndex((step, index) => index > firstReloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic provider diagnostics"));
const runDisabledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("runButtons[0].disabled === true"));
const reopenSettingsIndex = scenario.steps.findIndex((step, index) => index > runDisabledIndex && step?.type === "clickRole" && step?.name === "Performance metrics settings");
const persistedSelectionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('select')[0]?.value === 'agegroupId'"));
const clearSelectionIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Semantic provider diagnostics')") && String(step.expression || "").includes("runButtons[0].disabled === false"));
const secondReloadIndex = scenario.steps.findIndex((step, index) => index > recoveredIndex && step?.type === "reload");
const reboundBindingIndex = scenario.steps.findIndex((step, index) => index > secondReloadIndex && step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const reopenedSettingsAfterRecoveryIndex = scenario.steps.findIndex((step, index) => index > reboundBindingIndex && step?.type === "clickRole" && step?.name === "Performance metrics settings");
const clearedSelectionPersistedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("document.querySelectorAll('select')[0]?.value === ''"));

assert.notEqual(openSettingsIndex, -1);
assert.notEqual(selectAgeGroupIndex, -1);
assert.notEqual(firstDiagnosticsIndex, -1);
assert.notEqual(firstReloadIndex, -1);
assert.notEqual(reloadedDiagnosticsIndex, -1);
assert.notEqual(runDisabledIndex, -1);
assert.notEqual(reopenSettingsIndex, -1);
assert.notEqual(persistedSelectionIndex, -1);
assert.notEqual(clearSelectionIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(secondReloadIndex, -1);
assert.notEqual(reboundBindingIndex, -1);
assert.notEqual(reopenedSettingsAfterRecoveryIndex, -1);
assert.notEqual(clearedSelectionPersistedIndex, -1);

assert.equal(openSettingsIndex < selectAgeGroupIndex, true);
assert.equal(selectAgeGroupIndex < firstDiagnosticsIndex, true);
assert.equal(firstDiagnosticsIndex < firstReloadIndex, true);
assert.equal(firstReloadIndex < reloadedDiagnosticsIndex, true);
assert.equal(reloadedDiagnosticsIndex < runDisabledIndex, true);
assert.equal(runDisabledIndex < reopenSettingsIndex, true);
assert.equal(reopenSettingsIndex < persistedSelectionIndex, true);
assert.equal(persistedSelectionIndex < clearSelectionIndex, true);
assert.equal(clearSelectionIndex < recoveredIndex, true);
assert.equal(recoveredIndex < secondReloadIndex, true);
assert.equal(secondReloadIndex < reboundBindingIndex, true);
assert.equal(reboundBindingIndex < reopenedSettingsAfterRecoveryIndex, true);
assert.equal(reopenedSettingsAfterRecoveryIndex < clearedSelectionPersistedIndex, true);

console.log("report-builder-preview-semantic-persistence-scenario-assets ✓ desktop semantic invalid state persists across reload, then clears and stays cleared after recovery");
