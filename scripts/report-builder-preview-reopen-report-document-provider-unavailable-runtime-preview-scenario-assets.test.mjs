import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview.scenario.mjs";

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
  expressions.some((expression) => expression.includes("setSemanticModelProviderAvailable(false)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes("!semanticBinding") && expression.includes("!scopeSummary") && expression.includes('!text.includes("Model Ad Delivery")') && expression.includes('!text.includes("Entity Line Delivery")') && expression.includes('!text.includes("Dimensions Delivery Date, Channel")') && expression.includes('!text.includes("Measures Available Impressions")') && expression.includes("Retry model load")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__providerUnavailableBeforeRestore") && expression.includes("setSemanticModelProviderAvailable(true)")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getModelCount || 0") && expression.includes("> Number(metrics.__providerUnavailableBeforeRestore || 0)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('data-report-builder-scope-summary="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")') && expression.includes('text.includes("Filters")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-unavailable-runtime-preview")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const providerUnavailableIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("setSemanticModelProviderAvailable(false)"));
const unavailableVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context."));
const noFallbackMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('!text.includes("Model Ad Delivery")') && String(step?.expression || "").includes("!semanticBinding") && String(step?.expression || "").includes("!scopeSummary") && String(step?.expression || "").includes("Retry model load"));
const providerRestoredIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("setSemanticModelProviderAvailable(true)"));
const modelReloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("__providerUnavailableBeforeRestore"));
const recoveredBindingIndex = scenario.steps.findIndex((step, index) => index > modelReloadedIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const recoveredRuntimeMetadataIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes('text.includes("Measures Available Impressions")')
  && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")')
  && String(step?.expression || "").includes('text.includes("Filters")')
  && String(step?.expression || "").includes("!!semanticBinding")
  && String(step?.expression || "").includes("!!scopeSummary"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(providerUnavailableIndex, -1);
assert.notEqual(unavailableVisibleIndex, -1);
assert.notEqual(noFallbackMetadataIndex, -1);
assert.notEqual(providerRestoredIndex, -1);
assert.notEqual(modelReloadedIndex, -1);
assert.notEqual(recoveredBindingIndex, -1);
assert.notEqual(recoveredRuntimeMetadataIndex, -1);

assert.equal(selectedTrendIndex < reopenIndex, true);
assert.equal(reopenIndex < providerUnavailableIndex, true);
assert.equal(providerUnavailableIndex < unavailableVisibleIndex, true);
assert.equal(unavailableVisibleIndex < noFallbackMetadataIndex, true);
assert.equal(noFallbackMetadataIndex < providerRestoredIndex, true);
assert.equal(providerRestoredIndex < modelReloadedIndex, true);
assert.equal(modelReloadedIndex < recoveredBindingIndex, true);
assert.equal(recoveredBindingIndex < recoveredRuntimeMetadataIndex, true);

console.log("report-builder-preview-reopen-report-document-provider-unavailable-runtime-preview-scenario-assets ✓ reopened runtime preview blocks on provider absence without borrowing fallback semantic metadata and recovers after provider restore");
