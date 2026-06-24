import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-get-report-document-remove-duplicate-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titles.length === 1") && expression.includes("Inventory Note Copy") && expression.includes("bodyMatches === 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Remove Inventory Note")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Inventory Note removed from the authored report document.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-get-report-document-remove-duplicate-response")),
  true,
);

const addNarrativeIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Add narrative");
const duplicateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Duplicate Inventory Note");
const removeIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Remove Inventory Note"));
const removedMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Inventory Note removed from the authored report document."));
const selectedDemoIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Report Builder Demo"));
const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const responseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Report Builder Demo"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const semanticPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Governed reporting model for the report builder preview."));
const runtimeNarrativeIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("bodyMatches === 1"));

assert.notEqual(addNarrativeIndex, -1);
assert.notEqual(duplicateIndex, -1);
assert.notEqual(removeIndex, -1);
assert.notEqual(removedMessageIndex, -1);
assert.notEqual(selectedDemoIndex, -1);
assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(responseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(semanticPanelIndex, -1);
assert.notEqual(runtimeNarrativeIndex, -1);

assert.equal(addNarrativeIndex < duplicateIndex, true);
assert.equal(duplicateIndex < removeIndex, true);
assert.equal(removeIndex < removedMessageIndex, true);
assert.equal(removedMessageIndex < selectedDemoIndex, true);
assert.equal(selectedDemoIndex < openSelectedResponseIndex, true);
assert.equal(openSelectedResponseIndex < responseIndex, true);
assert.equal(responseIndex < reopenIndex, true);
assert.equal(reopenIndex < semanticPanelIndex, true);
assert.equal(semanticPanelIndex < runtimeNarrativeIndex, true);

console.log("report-builder-preview-selected-get-report-document-remove-duplicate-response-scenario-assets ✓ removed authored duplicate stays removed through selected response open and reopen");
