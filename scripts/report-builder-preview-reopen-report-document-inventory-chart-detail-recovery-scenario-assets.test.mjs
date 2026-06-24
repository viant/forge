import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-detail-recovery.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("detailTarget: null")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("Display")') && expression.includes('text.includes("Detail target resolved with omitted parameters:")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("inventory-chart-detail-recovery")),
  true,
);

const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detailTarget: null"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const firstChartClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle" && step?.index === 0);
const clearBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const secondChartClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-panel .recharts-bar-rectangle" && step?.index === 1);
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("target://example/performance/channel-detail")') && String(step?.expression || "").includes('text.includes("CTV")'));

assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(firstChartClickIndex, -1);
assert.notEqual(clearBehaviorIndex, -1);
assert.notEqual(secondChartClickIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(injectBehaviorIndex < reopenIndex, true);
assert.equal(reopenIndex < firstChartClickIndex, true);
assert.equal(firstChartClickIndex < clearBehaviorIndex, true);
assert.equal(clearBehaviorIndex < secondChartClickIndex, true);
assert.equal(secondChartClickIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-detail-recovery-scenario-assets ✓ reopened inventory chart detail recovery preserves omitted-parameter then recovered runtime resolution");
