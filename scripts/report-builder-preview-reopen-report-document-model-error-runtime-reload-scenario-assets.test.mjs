import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-model-error-runtime-reload.scenario.mjs";

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
  expressions.some((expression) => expression.includes("window.sessionStorage && window.sessionStorage.clear")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceSemanticModelBehaviors") && expression.includes("Semantic model metadata failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Number(metrics.getModelCount || 0) >= 1")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Number(metrics.getModelCount || 0) >= 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!button.disabled") && expression.includes("aria-disabled") && expression.includes("Retry model load")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic model error: Semantic model metadata failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('!text.includes("Model Ad Delivery")') && expression.includes('!text.includes("Entity Line Delivery")') && expression.includes('!text.includes("Dimensions Delivery Date, Channel")') && expression.includes('!text.includes("Measures Available Impressions")') && expression.includes("!semanticBinding") && expression.includes("!scopeSummary")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Compiled Report Runtime Preview")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('data-report-builder-scope-summary="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")') && expression.includes('text.includes("Filters")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("model-error-runtime-reload")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const injectModelErrorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticModelBehaviors"));
const postErrorReloadIndex = scenario.steps.findIndex((step, index) => index > injectModelErrorIndex && step?.type === "reload");
const modelErrorVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic model error: Semantic model metadata failed."));
const noFallbackMetadataWhileErroredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('!text.includes("Model Ad Delivery")') && String(step?.expression || "").includes("!semanticBinding") && String(step?.expression || "").includes("!scopeSummary"));
const retryModelReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Retry model load") && String(step?.expression || "").includes("!button.disabled"));
const retryModelButtonIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry model load");
const modelRecoveredIndex = scenario.steps.findIndex((step, index) => index > retryModelButtonIndex && step?.type === "assertDomNotContains" && String(step?.text || "").includes("Semantic model error: Semantic model metadata failed."));
const runtimePreviewVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(injectModelErrorIndex, -1);
assert.notEqual(postErrorReloadIndex, -1);
assert.notEqual(modelErrorVisibleIndex, -1);
assert.notEqual(noFallbackMetadataWhileErroredIndex, -1);
assert.notEqual(retryModelReadyIndex, -1);
assert.notEqual(retryModelButtonIndex, -1);
assert.notEqual(modelRecoveredIndex, -1);
assert.notEqual(runtimePreviewVisibleIndex, -1);

assert.equal(selectedTrendIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < injectModelErrorIndex, true);
assert.equal(injectModelErrorIndex < postErrorReloadIndex, true);
assert.equal(postErrorReloadIndex < modelErrorVisibleIndex, true);
assert.equal(modelErrorVisibleIndex < noFallbackMetadataWhileErroredIndex, true);
assert.equal(noFallbackMetadataWhileErroredIndex < retryModelReadyIndex, true);
assert.equal(retryModelReadyIndex < retryModelButtonIndex, true);
assert.equal(retryModelButtonIndex < modelRecoveredIndex, true);
assert.equal(modelRecoveredIndex < runtimePreviewVisibleIndex, true);

console.log("report-builder-preview-reopen-report-document-model-error-runtime-reload-scenario-assets ✓ reopened report survives semantic model metadata failure and recovers after retrying model load");
