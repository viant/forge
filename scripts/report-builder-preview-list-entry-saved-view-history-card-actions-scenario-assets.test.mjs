import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-saved-view-history-card-actions.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 18);

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
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse API not available.") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse API not available.") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview export behavior api not available") && expression.includes("demo-export-artifact-selected-saved-view-history") && expression.includes("reportBuilder.savedView://saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Recent exports") && expression.includes("Current export selection") && expression.includes("demo-export-artifact-selected-saved-view-history") && expression.includes("!text.includes('demo-export-artifact-reopened-published-snapshot-pinned')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf'") && expression.includes("payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType === 'application/pdf'") && expression.includes("%PDF-selected-entry saved-view history saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-saved-view-history-card-actions")),
  true,
);

const selectedSavedViewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const selectedPublishedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const restoreSavedViewIndex = scenario.steps.findIndex((step, index) => index > selectedPublishedIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const injectExportBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history"));
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export submit button not found"));
const acceptedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."));
const historyReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Recent exports") && String(step?.expression || "").includes("Refresh status"));
const cardRefreshIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected saved-view recent export refresh button not found."));
const refreshedHistoryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history") && String(step?.expression || "").includes("!text.includes('demo-export-artifact-1')"));
const currentSelectionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Current export selection") && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history"));
const cardDownloadIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected saved-view recent export download button not found."));
const downloadedArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf'"));
const downloadedArtifactPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("%PDF-selected-entry saved-view history saved_view_capacityTrendQ3"));

assert.notEqual(selectedSavedViewIndex, -1);
assert.notEqual(selectedPublishedIndex, -1);
assert.notEqual(restoreSavedViewIndex, -1);
assert.notEqual(injectExportBehaviorIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedIndex, -1);
assert.notEqual(historyReadyIndex, -1);
assert.notEqual(cardRefreshIndex, -1);
assert.notEqual(refreshedHistoryIndex, -1);
assert.notEqual(currentSelectionIndex, -1);
assert.notEqual(cardDownloadIndex, -1);
assert.notEqual(downloadedArtifactIndex, -1);
assert.notEqual(downloadedArtifactPayloadIndex, -1);

assert.equal(selectedSavedViewIndex < selectedPublishedIndex, true);
assert.equal(selectedPublishedIndex < restoreSavedViewIndex, true);
assert.equal(restoreSavedViewIndex < injectExportBehaviorIndex, true);
assert.equal(injectExportBehaviorIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedIndex, true);
assert.equal(acceptedIndex < historyReadyIndex, true);
assert.equal(historyReadyIndex < cardRefreshIndex, true);
assert.equal(cardRefreshIndex < refreshedHistoryIndex, true);
assert.equal(refreshedHistoryIndex < currentSelectionIndex, true);
assert.equal(currentSelectionIndex < cardDownloadIndex, true);
assert.equal(cardDownloadIndex < downloadedArtifactIndex, true);
assert.equal(downloadedArtifactIndex < downloadedArtifactPayloadIndex, true);

console.log("report-builder-preview-list-entry-saved-view-history-card-actions-scenario-assets ✓ selected saved-view history-card refresh and download actions stay source-pinned after same-report source switching");
