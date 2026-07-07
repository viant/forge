import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-selected-get-report-document-location-chart-validation-retry.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("country_code") && expression.includes("Semantic provider unavailable.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 8")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Locations Top Markets Q3")),
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
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('data-report-builder-scope-summary="true"') && expression.includes('text.includes("Dimensions Market")') && expression.includes('text.includes("Measures Available Impressions")') && expression.includes('text.includes("Filters")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 8")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-selected-get-report-document-location-chart-validation-retry")),
  true,
);

const injectValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticValidationBehaviors"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Locations Top Markets Q3"));
const inspectRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const templateIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Template: Capacity Location Brief"));
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const runtimePreviewVisibleWhileErroredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Market")'));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));
const runtimePreviewVisibleAfterRecoveryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Measures Available Impressions")') && scenario.steps.indexOf(step) > recoveredIndex);

assert.notEqual(injectValidationIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(inspectRequestIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(templateIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(runtimePreviewVisibleWhileErroredIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(runtimePreviewVisibleAfterRecoveryIndex, -1);

assert.equal(selectedEntryIndex < injectValidationIndex, true);
assert.equal(injectValidationIndex < inspectRequestIndex, true);
assert.equal(inspectRequestIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < validationErrorIndex, true);
assert.equal(templateIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < runtimePreviewVisibleWhileErroredIndex, true);
assert.equal(runtimePreviewVisibleWhileErroredIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);
assert.equal(recoveredIndex < runtimePreviewVisibleAfterRecoveryIndex, true);

console.log("report-builder-preview-reopen-selected-get-report-document-location-chart-validation-retry-scenario-assets ✓ reopened selected-get location chart validation retry keeps authored runtime semantic sections visible through semantic provider validation retry");
