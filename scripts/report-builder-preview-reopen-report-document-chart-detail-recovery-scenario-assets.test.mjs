import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-recovery.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors") && expression.includes("detailTarget: null")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearDetailTargetBehaviors")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!text.includes(\"missing-channel-detail\")")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-host-intent") && expression.includes("!= null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-recovery")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const injectDetailTargetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detailTarget: null"));
const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const firstLegendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action" && step?.index === 0);
const resolvedOmittedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Detail target resolved with omitted parameters:"));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors"));
const secondLegendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-builder__runtime-preview .forge-chart-legend-action" && step?.index === 1);
const recoveryHostIntentIndex = scenario.steps.findIndex((step, index) => index > secondLegendClickIndex && step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-host-intent") && String(step?.expression || "").includes("!= null"));
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes(\"target://example/performance/channel-detail\")") && String(step?.expression || "").includes("text.includes(\"CTV\")"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(injectDetailTargetIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(firstLegendClickIndex, -1);
assert.notEqual(resolvedOmittedIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(secondLegendClickIndex, -1);
assert.notEqual(recoveryHostIntentIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(selectedTrendIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < injectDetailTargetIndex, true);
assert.equal(injectDetailTargetIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < reopenIndex, true);
assert.equal(reopenIndex < firstLegendClickIndex, true);
assert.equal(firstLegendClickIndex < resolvedOmittedIndex, true);
assert.equal(resolvedOmittedIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < secondLegendClickIndex, true);
assert.equal(secondLegendClickIndex < recoveryResolvedIndex, true);
assert.equal(recoveryResolvedIndex < recoveryHostIntentIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-recovery-scenario-assets ✓ reopened chart detail recovery flow preserves omitted-parameter diagnostics and recovers to a resolved host intent");
