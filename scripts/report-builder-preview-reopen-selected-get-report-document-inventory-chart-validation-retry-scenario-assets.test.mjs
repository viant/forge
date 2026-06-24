import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-selected-get-report-document-inventory-chart-validation-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("channel") && expression.includes("Semantic provider unavailable.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 7")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Inventory Brief")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-selected-get-report-document-inventory-chart-validation-retry")),
  true,
);

const injectValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticValidationBehaviors"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3"));
const inspectRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const templateIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Template: Capacity Inventory Brief"));
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));

assert.notEqual(injectValidationIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(inspectRequestIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(templateIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.notEqual(recoveredIndex, -1);

assert.equal(selectedEntryIndex < injectValidationIndex, true);
assert.equal(injectValidationIndex < inspectRequestIndex, true);
assert.equal(inspectRequestIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < validationErrorIndex, true);
assert.equal(templateIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);

console.log("report-builder-preview-reopen-selected-get-report-document-inventory-chart-validation-retry-scenario-assets ✓ reopened selected-get inventory chart validation retry recovers after semantic provider validation retry");
