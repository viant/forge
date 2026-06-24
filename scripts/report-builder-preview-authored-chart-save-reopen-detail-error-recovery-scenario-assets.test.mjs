import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-chart-save-reopen-detail-error-recovery.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 30);

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
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("chartBlock") && expression.includes("Capacity Trend Block") && expression.includes("seriesField: 'channelV2'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearDetailTargetBehaviors API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("trendChart")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"kind\": \"chartBlock\"") && expression.includes("\"title\": \"Capacity Trend Block\"") && expression.includes("\"seriesField\": \"channelV2\"") && expression.includes("\"blockId\": \"trendChart\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Capacity Trend Block legend action not found.") && expression.includes("Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Capacity Trend Block detail action not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Capacity Trend Block CTV legend action not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.") && (expression.includes("!text.includes('Resolved detail target')") || expression.includes('!text.includes("Resolved detail target")'))),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes(\"Resolved detail target\")") && expression.includes("text.includes(\"target://example/performance/channel-detail\")") && expression.includes("text.includes(\"CTV\")")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-save-reopen-detail-error-recovery")),
  true,
);

const addChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const removeChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getHydratedReportDocumentSession") && String(step.expression || "").includes("demoReportBuilder"));
const firstLegendClickIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Capacity Trend Block legend action not found.") && String(step.expression || "").includes("Display"));
const firstDetailActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Capacity Trend Block detail action not found.") && String(step.expression || "").includes("Show channel details"));
const failureCheckIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed."));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("clearDetailTargetBehaviors API not available."));
const secondLegendClickIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Capacity Trend Block CTV legend action not found."));
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes(\"Resolved detail target\")") && String(step.expression || "").includes("text.includes(\"CTV\")"));

assert.notEqual(addChartIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(removeChartIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedSessionIndex, -1);
assert.notEqual(firstLegendClickIndex, -1);
assert.notEqual(firstDetailActionIndex, -1);
assert.notEqual(failureCheckIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(secondLegendClickIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(addChartIndex < draftIndex, true);
assert.equal(draftIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < injectBehaviorIndex, true);
assert.equal(injectBehaviorIndex < removeChartIndex, true);
assert.equal(removeChartIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedSessionIndex, true);
assert.equal(reopenedSessionIndex < firstLegendClickIndex, true);
assert.equal(firstLegendClickIndex < firstDetailActionIndex, true);
assert.equal(firstDetailActionIndex < failureCheckIndex, true);
assert.equal(failureCheckIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < secondLegendClickIndex, true);
assert.equal(secondLegendClickIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-authored-chart-save-reopen-detail-error-recovery-scenario-assets ✓ authored chart detail failure and recovery survive save/get/reopen after post-save removal");
