import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchBuilderState({ selectedDimensions: ['eventDate'] })")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("selectedDimensions[0] === 'channelV2'") && expression.includes("activeTablePreset?.title === 'Inventory Ladder'") && expression.includes("binding?.mode === 'semantic'")),
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
  expressions.some((expression) => expression.includes("selectedDimensions[0] === 'eventDate'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityQ3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 4")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Publisher = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Site Type = Acme Media")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-response")),
  true,
);

const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'] })"));
const selectedCapacityIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const documentVersionFourIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"documentVersion\": 4"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Q3"));
const firstReopenedNoticeIndex = reopenedNoticeIndexes[0] ?? -1;
const secondReopenedNoticeIndex = reopenedNoticeIndexes[1] ?? -1;
const drillPublisherIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Publisher");
const drillSiteTypeIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Site Type");
const reloadIndex = scenario.steps.findIndex((step, index) => index > drillSiteTypeIndex && step?.type === "reload");
const restoreLiveBuilderIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Restore live builder");
const restoredMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument."));
const finalEventDateIndex = scenario.steps.findIndex((step, index) => index > restoreLiveBuilderIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'"));

assert.notEqual(selectedCapacityIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(documentVersionFourIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.equal(reopenedNoticeIndexes.length >= 2, true);
assert.notEqual(firstReopenedNoticeIndex, -1);
assert.notEqual(secondReopenedNoticeIndex, -1);
assert.notEqual(drillPublisherIndex, -1);
assert.notEqual(drillSiteTypeIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(restoreLiveBuilderIndex, -1);
assert.notEqual(restoredMessageIndex, -1);
assert.notEqual(finalEventDateIndex, -1);

assert.equal(selectedCapacityIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < documentVersionFourIndex, true);
assert.equal(documentVersionFourIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < reopenIndex, true);
assert.equal(reopenIndex < firstReopenedNoticeIndex, true);
assert.equal(firstReopenedNoticeIndex < drillPublisherIndex, true);
assert.equal(drillPublisherIndex < drillSiteTypeIndex, true);
assert.equal(drillSiteTypeIndex < reloadIndex, true);
assert.equal(reloadIndex < secondReopenedNoticeIndex, true);
assert.equal(secondReopenedNoticeIndex < restoreLiveBuilderIndex, true);
assert.equal(restoreLiveBuilderIndex < restoredMessageIndex, true);
assert.equal(restoredMessageIndex < finalEventDateIndex, true);

console.log("report-builder-preview-reopen-report-document-response-scenario-assets ✓ reopened report document restores semantic channel binding, supports drill navigation, persists across reload, and restores the live builder snapshot");
