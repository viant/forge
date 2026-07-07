import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-saved-view-history-card-use-current.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview export behavior api not available") && expression.includes("demo-export-artifact-selected-saved-view-history-a") && expression.includes("demo-export-artifact-selected-saved-view-history-b")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected saved-view history A Use current button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Current export selection") && expression.includes("demo-export-artifact-selected-saved-view-history-a") && expression.includes("!otherText.includes('Current export selection')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("%PDF-selected-entry saved-view history A saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-saved-view-history-card-use-current")),
  true,
);

const selectedSavedViewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const selectedPublishedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const restoredSavedViewIndex = scenario.steps.findIndex((step, index) => index > selectedPublishedIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history-a"));
const firstSubmitIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export submit button not found"));
const firstAcceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const secondSubmitIndex = scenario.steps.findIndex((step, index) => index > firstRefreshIndex && step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export submit button not found"));
const secondAcceptedIndex = scenario.steps.findIndex((step, index) => index > secondSubmitIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."));
const secondRefreshIndex = scenario.steps.findIndex((step, index) => index > secondAcceptedIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const historyListIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history-a") && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history-b"));
const useCurrentIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected saved-view history A Use current button not found."));
const switchedCurrentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Current export selection") && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history-a") && String(step?.expression || "").includes("!otherText.includes('Current export selection')"));
const downloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf'"));
const downloadedPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("%PDF-selected-entry saved-view history A saved_view_capacityTrendQ3"));

assert.notEqual(selectedSavedViewIndex, -1);
assert.notEqual(selectedPublishedIndex, -1);
assert.notEqual(restoredSavedViewIndex, -1);
assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(firstSubmitIndex, -1);
assert.notEqual(firstAcceptedIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(secondSubmitIndex, -1);
assert.notEqual(secondAcceptedIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(historyListIndex, -1);
assert.notEqual(useCurrentIndex, -1);
assert.notEqual(switchedCurrentIndex, -1);
assert.notEqual(downloadIndex, -1);
assert.notEqual(downloadedIndex, -1);
assert.notEqual(downloadedPayloadIndex, -1);

assert.equal(selectedSavedViewIndex < selectedPublishedIndex, true);
assert.equal(selectedPublishedIndex < restoredSavedViewIndex, true);
assert.equal(restoredSavedViewIndex < injectBehaviorIndex, true);
assert.equal(injectBehaviorIndex < firstSubmitIndex, true);
assert.equal(firstSubmitIndex < firstAcceptedIndex, true);
assert.equal(firstAcceptedIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < secondSubmitIndex, true);
assert.equal(secondSubmitIndex < secondAcceptedIndex, true);
assert.equal(secondAcceptedIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < historyListIndex, true);
assert.equal(historyListIndex < useCurrentIndex, true);
assert.equal(useCurrentIndex < switchedCurrentIndex, true);
assert.equal(switchedCurrentIndex < downloadIndex, true);
assert.equal(downloadIndex < downloadedIndex, true);
assert.equal(downloadedIndex < downloadedPayloadIndex, true);

console.log("report-builder-preview-list-entry-saved-view-history-card-use-current-scenario-assets ✓ selected saved-view Use current action stays source-pinned after same-report source switching");
