import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-provider-unavailable-create-payload.scenario.mjs";

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
  expressions.some((expression) => expression.includes("!retryButton")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload: Capacity Trend Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Create ReportDocument payload summary\"]") && expression.includes("\"modelRef\": \"model://example/performance/delivery@v1\"") && expression.includes("\"entity\": \"line_delivery\"") && expression.includes("!text.includes('\"modelLabel\": \"Ad Delivery\"')") && expression.includes("!text.includes('\"entityLabel\": \"Line Delivery\"')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-unavailable-create-payload")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const providerUnavailableIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("setSemanticModelProviderAvailable(false)"));
const unavailableVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic model unavailable: Semantic binding is active, but no semantic model provider is available in the current runtime context."));
const prepareCreatePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare create payload");
const payloadSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("CREATEREPORTDOCUMENTPAYLOAD") && String(step?.expression || "").includes("CAPACITYTRENDQ3"));
const payloadSemanticSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("\"modelRef\": \"model://example/performance/delivery@v1\"") && String(step?.expression || "").includes("!text.includes('\"modelLabel\": \"Ad Delivery\"')"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(providerUnavailableIndex, -1);
assert.notEqual(unavailableVisibleIndex, -1);
assert.notEqual(prepareCreatePayloadIndex, -1);
assert.notEqual(payloadSummaryIndex, -1);
assert.notEqual(payloadSemanticSummaryIndex, -1);

assert.equal(selectedTrendIndex < reopenIndex, true);
assert.equal(reopenIndex < providerUnavailableIndex, true);
assert.equal(providerUnavailableIndex < unavailableVisibleIndex, true);
assert.equal(unavailableVisibleIndex < prepareCreatePayloadIndex, true);
assert.equal(prepareCreatePayloadIndex < payloadSummaryIndex, true);
assert.equal(payloadSummaryIndex < payloadSemanticSummaryIndex, true);

console.log("report-builder-preview-reopen-report-document-provider-unavailable-create-payload-scenario-assets ✓ reopened create payload keeps semantic identity refs but omits provider-backed fallback labels when the semantic provider is unavailable");
