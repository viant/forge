import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-error-recovery.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearDetailTargetBehaviors API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.") && (expression.includes("!text.includes('Resolved detail target')") || expression.includes('!text.includes("Resolved detail target")'))),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("Resolved detail target")') && expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && expression.includes("!= null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-error-recovery")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const firstLegendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-chart-legend-action" && step?.index === 0);
const failureCheckIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed."));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const secondLegendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-chart-legend-action" && step?.index === 1);
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("Resolved detail target")') && String(step?.expression || "").includes('text.includes("CTV")'));

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(firstLegendClickIndex, -1);
assert.notEqual(failureCheckIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(secondLegendClickIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(injectBehaviorIndex < reopenIndex, true);
assert.equal(reopenIndex < firstLegendClickIndex, true);
assert.equal(firstLegendClickIndex < failureCheckIndex, true);
assert.equal(failureCheckIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < secondLegendClickIndex, true);
assert.equal(secondLegendClickIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-error-recovery-scenario-assets ✓ reopened chart detail failure and recovery flow preserves runtime resolution");
