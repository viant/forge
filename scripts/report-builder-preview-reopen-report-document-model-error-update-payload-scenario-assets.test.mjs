import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-model-error-update-payload.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSemanticModelBehaviors") && expression.includes("Semantic model metadata failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic model error: Semantic model metadata failed.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Dimensions Delivery Date, Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Measures Available Impressions")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Using expected version 6.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"expectedVersion\": 6")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"semanticSummary\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"modelLabel\": \"Ad Delivery\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"entityLabel\": \"Line Delivery\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("model-error-update-payload")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const injectModelErrorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticModelBehaviors"));
const reopenIndexes = scenario.steps.reduce((indexes, step, index) => {
  if (step?.type === "clickRole" && step?.name === "Reopen in builder") {
    indexes.push(index);
  }
  return indexes;
}, []);
const reopenIndex = reopenIndexes[reopenIndexes.length - 1] ?? -1;
const modelErrorVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic model error: Semantic model metadata failed."));
const bindingVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic Binding"));
const expectedVersionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Using expected version 6."));
const prepareUpdatePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare update payload");
const semanticSummaryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"semanticSummary\": {"));
const modelLabelIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"modelLabel\": \"Ad Delivery\""));
const entityLabelIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"entityLabel\": \"Line Delivery\""));
const payloadVersionIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"expectedVersion\": 6"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(injectModelErrorIndex, -1);
assert.equal(reopenIndexes.length >= 2, true);
assert.notEqual(reopenIndex, -1);
assert.notEqual(modelErrorVisibleIndex, -1);
assert.notEqual(bindingVisibleIndex, -1);
assert.notEqual(expectedVersionIndex, -1);
assert.notEqual(prepareUpdatePayloadIndex, -1);
assert.notEqual(semanticSummaryIndex, -1);
assert.notEqual(modelLabelIndex, -1);
assert.notEqual(entityLabelIndex, -1);
assert.notEqual(payloadVersionIndex, -1);

assert.equal(selectedTrendIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < injectModelErrorIndex, true);
assert.equal(injectModelErrorIndex < modelErrorVisibleIndex, true);
assert.equal(injectModelErrorIndex < reopenIndex, true);
assert.equal(reopenIndex < modelErrorVisibleIndex, true);
assert.equal(modelErrorVisibleIndex < bindingVisibleIndex, true);
assert.equal(bindingVisibleIndex < expectedVersionIndex, true);
assert.equal(expectedVersionIndex < prepareUpdatePayloadIndex, true);
assert.equal(prepareUpdatePayloadIndex < semanticSummaryIndex, true);
assert.equal(semanticSummaryIndex < modelLabelIndex, true);
assert.equal(modelLabelIndex < entityLabelIndex, true);
assert.equal(entityLabelIndex < payloadVersionIndex, true);
assert.equal(prepareUpdatePayloadIndex < payloadVersionIndex, true);

console.log("report-builder-preview-reopen-report-document-model-error-update-payload-scenario-assets ✓ reopened report retains semantic metadata through model error while preparing update payload");
