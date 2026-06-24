import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-chart-legend-action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected value:") && expression.includes("Display") && expression.includes("Show channel details")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-report-runtime-host-intent__parameter")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Resolved detail target")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-response")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })"));
const preReopenTableStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'") && String(step?.expression || "").includes("chartSpec == null"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const legendWaitIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("forge-chart-legend-action"));
const legendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected value:") && String(step?.expression || "").includes("Display"));
const showDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Show channel details");
const resolvedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > resolvedIndex && step?.type === "reload");
const restoreIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Restore live builder");
const finalTableStateIndex = scenario.steps.findIndex((step, index) => index > restoreIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'") && String(step?.expression || "").includes("chartSpec == null"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(preReopenTableStateIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(legendWaitIndex, -1);
assert.notEqual(legendClickIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(showDetailIndex, -1);
assert.notEqual(resolvedIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(restoreIndex, -1);
assert.notEqual(finalTableStateIndex, -1);

assert.equal(selectedTrendIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < preReopenTableStateIndex, true);
assert.equal(preReopenTableStateIndex < reopenIndex, true);
assert.equal(reopenIndex < legendWaitIndex, true);
assert.equal(legendWaitIndex < legendClickIndex, true);
assert.equal(legendClickIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < showDetailIndex, true);
assert.equal(showDetailIndex < resolvedIndex, true);
assert.equal(resolvedIndex < reloadIndex, true);
assert.equal(reloadIndex < restoreIndex, true);
assert.equal(restoreIndex < finalTableStateIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-response-scenario-assets ✓ reopened chart detail response resolves host intent and restores the live builder snapshot");
