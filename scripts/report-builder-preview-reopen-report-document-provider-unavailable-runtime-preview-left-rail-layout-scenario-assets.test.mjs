import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-provider-unavailable-runtime-preview-left-rail-layout.scenario.mjs";

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
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_PROVIDER_UNAVAILABLE_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("drillPanel.scrollWidth <= drillPanel.clientWidth + 1") && expression.includes("!semanticBinding") && expression.includes("!scopeSummary") && expression.includes("Compile the authored runtime preview") && expression.includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("!!semanticBinding") && expression.includes("!!scopeSummary") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("Measures Available Impressions") && expression.includes("!bodyText.includes(\"Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.\")")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-unavailable-runtime-preview-left-rail-layout")),
  true,
);

const unavailableVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context."));
const noFallbackMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('!text.includes("Model Ad Delivery")') && String(step?.expression || "").includes("!semanticBinding") && String(step?.expression || "").includes("!scopeSummary"));
const narrowRailUnavailableIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailUnavailableSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Compile the authored runtime preview") && String(step?.expression || "").includes("!semanticBinding") && String(step?.expression || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context."));
const providerRestoredIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("setSemanticModelProviderAvailable(true)"));
const recoveredRuntimeMetadataIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes('text.includes("Measures Available Impressions")')
  && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")')
  && String(step?.expression || "").includes('text.includes("Filters")')
  && String(step?.expression || "").includes("!!semanticBinding")
  && String(step?.expression || "").includes("!!scopeSummary"));
const narrowRailRecoveredSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!!semanticBinding") && String(step?.expression || "").includes("!!scopeSummary") && String(step?.expression || "").includes("Dimensions Delivery Date, Channel") && String(step?.expression || "").includes("!bodyText.includes(\"Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context.\")"));

assert.notEqual(unavailableVisibleIndex, -1);
assert.notEqual(noFallbackMetadataIndex, -1);
assert.notEqual(narrowRailUnavailableIndex, -1);
assert.notEqual(narrowRailUnavailableSettledIndex, -1);
assert.notEqual(providerRestoredIndex, -1);
assert.notEqual(recoveredRuntimeMetadataIndex, -1);
assert.notEqual(narrowRailRecoveredSettledIndex, -1);

assert.equal(unavailableVisibleIndex < noFallbackMetadataIndex, true);
assert.equal(noFallbackMetadataIndex < narrowRailUnavailableIndex, true);
assert.equal(narrowRailUnavailableIndex < narrowRailUnavailableSettledIndex, true);
assert.equal(narrowRailUnavailableSettledIndex < providerRestoredIndex, true);
assert.equal(providerRestoredIndex < recoveredRuntimeMetadataIndex, true);
assert.equal(recoveredRuntimeMetadataIndex < narrowRailRecoveredSettledIndex, true);

console.log("report-builder-preview-reopen-report-document-provider-unavailable-runtime-preview-left-rail-layout-scenario-assets ✓ reopened provider-unavailable runtime preview keeps blocked and recovered semantic metadata readable under a narrowed setup rail");
