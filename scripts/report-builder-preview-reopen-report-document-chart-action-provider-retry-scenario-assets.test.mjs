import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-action-provider-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceRuntimeActionBehaviors") && expression.includes("Preview runtime action provider failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Failed to load refinement actions for Channel.") && expression.includes("Preview runtime action provider failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Retry action provider")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Retrying action provider")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail") && expression.includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-action-provider-retry")),
  true,
);

const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const replaceFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Preview runtime action provider failed."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const retryButtonIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Retry action provider"));
const replaceSuccessIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail_channel") && String(step?.expression || "").includes("delayMs: 1200"));
const clickRetryIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Retry action provider button not found in reopened runtime surface."));
const clickActionIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Show channel details action not found after provider retry."));
const resolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("target://example/performance/channel-detail") && String(step?.expression || "").includes("Display"));

assert.notEqual(prepareGetIndex, -1);
assert.notEqual(replaceFailureIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(retryButtonIndex, -1);
assert.notEqual(replaceSuccessIndex, -1);
assert.notEqual(clickRetryIndex, -1);
assert.notEqual(clickActionIndex, -1);
assert.notEqual(resolvedIndex, -1);

assert.equal(prepareGetIndex < replaceFailureIndex, true);
assert.equal(replaceFailureIndex < reopenIndex, true);
assert.equal(reopenIndex < retryButtonIndex, true);
assert.equal(retryButtonIndex < replaceSuccessIndex, true);
assert.equal(replaceSuccessIndex < clickRetryIndex, true);
assert.equal(clickRetryIndex < clickActionIndex, true);
assert.equal(clickActionIndex < resolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-action-provider-retry-scenario-assets ✓ reopened chart action provider retry restores runtime actions after retry");
