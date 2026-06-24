import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-native-detail-error-recovery.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Inventory Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("inventory-chart-native-detail-error-recovery")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const failureMarkIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .recharts-bar-rectangle" && step?.index === 0);
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const recoveryMarkIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .recharts-bar-rectangle" && step?.index === 1);
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("target://example/performance/channel-detail")') && String(step?.expression || "").includes('text.includes("CTV")'));

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(failureMarkIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(recoveryMarkIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(injectBehaviorIndex < reopenIndex, true);
assert.equal(reopenIndex < failureMarkIndex, true);
assert.equal(failureMarkIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < recoveryMarkIndex, true);
assert.equal(recoveryMarkIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-native-detail-error-recovery-scenario-assets ✓ reopened inventory native chart detail failure and recovery preserve runtime resolution");
