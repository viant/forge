import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-inventory-chart-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityInventoryTopChannelsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("selectedDimensions[0] === 'channelV2'") && expression.includes("chartSpec?.title === 'Inventory · Top Channels'") && expression.includes("chartSpec?.type === 'horizontal_bar'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Publisher')") && expression.includes("!labels.includes('Channel')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Site Type')") && expression.includes("!labels.includes('Publisher')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityInventoryTopChannelsQ3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Publisher = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Drill to Publisher = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Site Type = Acme Media")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Drill to Site Type = Acme Media")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-inventory-chart-response")),
  true,
);

const selectedInventoryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Inventory Top Channels Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const documentVersionSevenIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"documentVersion\": 7"));
const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'], viewMode: 'table', chartSpec: null })"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Inventory Top Channels Q3"));
const firstReopenedNoticeIndex = reopenedNoticeIndexes[0] ?? -1;
const postReloadReopenedNoticeIndex = reopenedNoticeIndexes[reopenedNoticeIndexes.length - 1] ?? -1;
const rowActionWaitIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("forge-report-runtime-table-panel .forge-dashboard-row-action"));
const drillPublisherIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Publisher");
const drillPublisherValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Publisher = Display"));
const drillPublisherChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Publisher = Display"));
const drillSiteTypeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Site Type");
const drillSiteTypeValueIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Site Type = Acme Media"));
const drillSiteTypeChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Site Type = Acme Media"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > drillSiteTypeIndex && step?.type === "reload");
const restoreLiveBuilderIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Restore live builder");
const restoredMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument."));
const finalEventDateIndex = scenario.steps.findIndex((step, index) => index > restoreLiveBuilderIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'") && String(step?.expression || "").includes("viewMode === 'table'"));

assert.notEqual(selectedInventoryIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(documentVersionSevenIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.equal(reopenedNoticeIndexes.length >= 2, true);
assert.notEqual(firstReopenedNoticeIndex, -1);
assert.notEqual(postReloadReopenedNoticeIndex, -1);
assert.notEqual(rowActionWaitIndex, -1);
assert.notEqual(drillPublisherIndex, -1);
assert.notEqual(drillPublisherValueIndex, -1);
assert.notEqual(drillPublisherChipIndex, -1);
assert.notEqual(drillSiteTypeIndex, -1);
assert.notEqual(drillSiteTypeValueIndex, -1);
assert.notEqual(drillSiteTypeChipIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(restoreLiveBuilderIndex, -1);
assert.notEqual(restoredMessageIndex, -1);
assert.notEqual(finalEventDateIndex, -1);

assert.equal(selectedInventoryIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < documentVersionSevenIndex, true);
assert.equal(documentVersionSevenIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < reopenIndex, true);
assert.equal(reopenIndex < firstReopenedNoticeIndex, true);
assert.equal(firstReopenedNoticeIndex < rowActionWaitIndex, true);
assert.equal(rowActionWaitIndex < drillPublisherIndex, true);
assert.equal(drillPublisherIndex < drillPublisherValueIndex, true);
assert.equal(drillPublisherValueIndex < drillPublisherChipIndex, true);
assert.equal(drillPublisherChipIndex < drillSiteTypeIndex, true);
assert.equal(drillSiteTypeIndex < drillSiteTypeValueIndex, true);
assert.equal(drillSiteTypeValueIndex < drillSiteTypeChipIndex, true);
assert.equal(drillSiteTypeChipIndex < reloadIndex, true);
assert.equal(reloadIndex < postReloadReopenedNoticeIndex, true);
assert.equal(postReloadReopenedNoticeIndex < restoreLiveBuilderIndex, true);
assert.equal(restoreLiveBuilderIndex < restoredMessageIndex, true);
assert.equal(restoredMessageIndex < finalEventDateIndex, true);

console.log("report-builder-preview-reopen-report-document-inventory-chart-response-scenario-assets ✓ reopened inventory chart report restores semantic chart binding, supports chart-to-inventory drill navigation, persists across reload, and restores the live builder snapshot");
