import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-validation-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("Semantic provider unavailable.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("inventory-chart-validation-retry")),
  true,
);

const injectValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticValidationBehaviors"));
const prepareSelectedGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));

assert.notEqual(injectValidationIndex, -1);
assert.notEqual(prepareSelectedGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.notEqual(recoveredIndex, -1);

assert.equal(injectValidationIndex < prepareSelectedGetIndex, true);
assert.equal(prepareSelectedGetIndex < reopenIndex, true);
assert.equal(reopenIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-validation-retry-scenario-assets ✓ reopened inventory chart validation retry recovers after semantic provider validation retry");
