import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-validation-retry.scenario.mjs";

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

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("Semantic provider unavailable.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("activeTablePreset?.title === 'Inventory Ladder'") && expression.includes("selectedDimensions[0] === 'channelV2'") && expression.includes("!window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Semantic provider unavailable.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Retry validation")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('data-report-builder-scope-summary="true"') && expression.includes('text.includes("Dimensions Channel")') && expression.includes('text.includes("Measures Available Impressions, Household Uniques")') && expression.includes('text.includes("Filters")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Validating the semantic selection against the provider.") || expression.includes("Showing Inventory Ladder.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("validation-retry")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Q3"));
const injectValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticValidationBehaviors"));
const prepareSelectedGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const runtimePreviewVisibleWhileErroredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Channel")'));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredStateIndexes = findStepIndexes((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("activeTablePreset?.title === 'Inventory Ladder'") && String(step?.expression || "").includes("selectedDimensions[0] === 'channelV2'") && String(step?.expression || "").includes("!window.__REPORT_BUILDER_PREVIEW__.getBuilderState()?.explorationSession"));
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));
const runtimePreviewVisibleAfterRecoveryIndex = findStepIndexes((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Measures Available Impressions, Household Uniques")')).slice(-1)[0] ?? -1;

assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(injectValidationIndex, -1);
assert.notEqual(prepareSelectedGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(runtimePreviewVisibleWhileErroredIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.equal(recoveredStateIndexes.length >= 2, true);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(runtimePreviewVisibleAfterRecoveryIndex, -1);

assert.equal(selectedEntryIndex < injectValidationIndex, true);
assert.equal(injectValidationIndex < prepareSelectedGetIndex, true);
assert.equal(prepareSelectedGetIndex < reopenIndex, true);
assert.equal(reopenIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < runtimePreviewVisibleWhileErroredIndex, true);
assert.equal(runtimePreviewVisibleWhileErroredIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);
assert.equal(recoveredIndex < runtimePreviewVisibleAfterRecoveryIndex, true);
assert.equal(runtimePreviewVisibleAfterRecoveryIndex < recoveredStateIndexes[recoveredStateIndexes.length - 1], true);

console.log("report-builder-preview-reopen-report-document-validation-retry-scenario-assets ✓ reopened table validation retry keeps authored runtime semantic sections visible through semantic provider validation retry");
