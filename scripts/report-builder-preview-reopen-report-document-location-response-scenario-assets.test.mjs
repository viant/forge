import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("selectedDimensions[0] === 'country'") && expression.includes("activeTablePreset?.title === 'Location Ladder'") && expression.includes("binding?.mode === 'semantic'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Region')") && expression.includes("!labels.includes('Market')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("labels.includes('Metro Area')") && expression.includes("!labels.includes('Region')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Location Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityLocationQ3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 5")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Region")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Drill to Region = US")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Drill to Metro Area = West")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-location-response")),
  true,
);

const selectedLocationIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Location Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const documentVersionFiveIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"documentVersion\": 5"));
const patchLiveBuilderIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState({ selectedDimensions: ['eventDate'] })"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Location Q3"));
const firstReopenedNoticeIndex = reopenedNoticeIndexes[0] ?? -1;
const secondReopenedNoticeIndex = reopenedNoticeIndexes[1] ?? -1;
const drillRegionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Region");
const drillRegionValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Region = US"));
const drillMetroIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.text === "Drill to Metro Area");
const drillMetroValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Metro Area = West"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > drillMetroIndex && step?.type === "reload");
const restoreLiveBuilderIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Restore live builder");
const restoredMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Restored the live builder state from before reopening the saved ReportDocument."));
const finalEventDateIndex = scenario.steps.findIndex((step, index) => index > restoreLiveBuilderIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("selectedDimensions[0] === 'eventDate'"));

assert.notEqual(selectedLocationIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(documentVersionFiveIndex, -1);
assert.notEqual(patchLiveBuilderIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.equal(reopenedNoticeIndexes.length >= 2, true);
assert.notEqual(firstReopenedNoticeIndex, -1);
assert.notEqual(secondReopenedNoticeIndex, -1);
assert.notEqual(drillRegionIndex, -1);
assert.notEqual(drillRegionValueIndex, -1);
assert.notEqual(drillMetroIndex, -1);
assert.notEqual(drillMetroValueIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(restoreLiveBuilderIndex, -1);
assert.notEqual(restoredMessageIndex, -1);
assert.notEqual(finalEventDateIndex, -1);

assert.equal(selectedLocationIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < documentVersionFiveIndex, true);
assert.equal(documentVersionFiveIndex < patchLiveBuilderIndex, true);
assert.equal(patchLiveBuilderIndex < reopenIndex, true);
assert.equal(reopenIndex < firstReopenedNoticeIndex, true);
assert.equal(firstReopenedNoticeIndex < drillRegionIndex, true);
assert.equal(drillRegionIndex < drillRegionValueIndex, true);
assert.equal(drillRegionValueIndex < drillMetroIndex, true);
assert.equal(drillMetroIndex < drillMetroValueIndex, true);
assert.equal(drillMetroValueIndex < reloadIndex, true);
assert.equal(reloadIndex < secondReopenedNoticeIndex, true);
assert.equal(secondReopenedNoticeIndex < restoreLiveBuilderIndex, true);
assert.equal(restoreLiveBuilderIndex < restoredMessageIndex, true);
assert.equal(restoredMessageIndex < finalEventDateIndex, true);

console.log("report-builder-preview-reopen-report-document-location-response-scenario-assets ✓ reopened location report restores semantic location binding, supports ladder drill navigation, persists across reload, and restores the live builder snapshot");
