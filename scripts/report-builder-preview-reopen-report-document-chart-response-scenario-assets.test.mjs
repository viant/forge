import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-response.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 40);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("selectedDimensions.includes('eventDate')") && expression.includes("selectedDimensions.includes('channelV2')") && expression.includes("chartSpec?.title === 'Avails by Date and Channel'") && expression.includes("chartSpec?.type === 'area'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("forge-chart-legend-action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('Market')") && expression.includes("!text.includes('Channel')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityTrendQ3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 6")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Market = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected value: Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-chart-response")),
  true,
);

const selectedTrendIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const documentVersionSixIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"documentVersion\": 6"));
const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Trend Q3"));
const firstReopenedNoticeIndex = reopenedNoticeIndexes[0] ?? -1;
const secondReopenedNoticeIndex = reopenedNoticeIndexes[1] ?? -1;
const legendWaitIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("forge-chart-legend-action"));
const legendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected value: Display"));
const drillMarketIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Market");
const reloadIndex = scenario.steps.findIndex((step, index) => index > drillMarketIndex && step?.type === "reload");
const restoreLiveBuilderIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Restore live builder");
const restoredMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument."));
const finalEventDateIndex = scenario.steps.findIndex((step, index) => index > restoreLiveBuilderIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'") && String(step?.expression || "").includes("viewMode === 'table'"));

assert.notEqual(selectedTrendIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(documentVersionSixIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.equal(reopenedNoticeIndexes.length >= 2, true);
assert.notEqual(firstReopenedNoticeIndex, -1);
assert.notEqual(secondReopenedNoticeIndex, -1);
assert.notEqual(legendWaitIndex, -1);
assert.notEqual(legendClickIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(drillMarketIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(restoreLiveBuilderIndex, -1);
assert.notEqual(restoredMessageIndex, -1);
assert.notEqual(finalEventDateIndex, -1);

assert.equal(selectedTrendIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < documentVersionSixIndex, true);
assert.equal(documentVersionSixIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < reopenIndex, true);
assert.equal(reopenIndex < firstReopenedNoticeIndex, true);
assert.equal(firstReopenedNoticeIndex < legendWaitIndex, true);
assert.equal(legendWaitIndex < legendClickIndex, true);
assert.equal(legendClickIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < drillMarketIndex, true);
assert.equal(drillMarketIndex < reloadIndex, true);
assert.equal(reloadIndex < secondReopenedNoticeIndex, true);
assert.equal(secondReopenedNoticeIndex < restoreLiveBuilderIndex, true);
assert.equal(restoreLiveBuilderIndex < restoredMessageIndex, true);
assert.equal(restoredMessageIndex < finalEventDateIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-response-scenario-assets ✓ reopened chart report restores semantic chart binding, supports chart drill navigation, persists across reload, and restores the live builder snapshot");
