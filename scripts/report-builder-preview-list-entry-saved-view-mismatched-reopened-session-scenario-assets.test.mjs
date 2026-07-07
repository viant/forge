import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-saved-view-mismatched-reopened-session.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step, index)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Trend Q3 Published Snapshot for editing.")),
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
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Published Snapshot Runtime Note") && expression.includes("should stay isolated")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Get ReportDocument response summary"]') && expression.includes('"kind": "reportBuilder.savedView"') && expression.includes('"sourceArtifactId": "saved_view_capacityTrendQ3"') && expression.includes("!text.includes(")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"') && expression.includes("!raw.includes(")),
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
  expressions.some((expression) => expression.includes("demo-export-artifact-selected-saved-view-history") && expression.includes("!text.includes('demo-export-artifact-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Recent exports") && expression.includes("Current export selection") && expression.includes("demo-export-artifact-selected-saved-view-history") && expression.includes("!text.includes('demo-export-artifact-reopened-published-snapshot-pinned')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("saved_view_capacityTrendQ3") && expression.includes("published_snapshot_capacityTrendQ3") && expression.includes("Inspect export") && expression.includes("Reopened ReportDocument: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Inspect export button not found in reopened saved-view section.") && expression.includes("Reopened ReportDocument: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export request summary") && expression.includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"') && expression.includes("!raw.includes(")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview export behavior api not available") && expression.includes("demo-export-artifact-reopened-saved-view-pinned") && expression.includes("reportBuilder.savedView://saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-reopened-saved-view-pinned") && expression.includes("!text.includes('demo-export-artifact-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Recent exports") && expression.includes("Current export selection") && expression.includes("demo-export-artifact-reopened-saved-view-pinned") && expression.includes("!text.includes('demo-export-artifact-reopened-published-snapshot-pinned')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf'") && expression.includes("payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType === 'application/pdf'") && expression.includes("%PDF-pinned reopened saved-view saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-saved-view-mismatched-reopened-session")),
  true,
);

const selectedSavedViewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const replacePreparedResponseIndexes = findStepIndexes((step) => step?.type === "eval" && String(step?.expression || "").includes("replacePreparedListReportDocumentsResponse API not available."));
const switchToPublishedIndex = replacePreparedResponseIndexes[0] ?? -1;
const selectedPublishedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const reopenPublishedIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const noteMutationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Published Snapshot Runtime Note") && String(step?.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const switchBackToSavedViewIndex = replacePreparedResponseIndexes[1] ?? -1;
const selectedSavedViewIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const selectedSavedViewAgainIndex = selectedSavedViewIndexes[1] ?? -1;
const prepareSelectedResponseIndexes = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const prepareSavedViewResponseIndex = prepareSelectedResponseIndexes[1] ?? -1;
const savedViewResponseSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label="Get ReportDocument response summary"]'));
const savedViewExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected list entry export request summary") && String(step?.expression || "").includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"'));
const injectSelectedExportBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history"));
const submitSelectedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export submit button not found"));
const acceptedSelectedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."));
const refreshSelectedExportIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const selectedPinnedArtifactSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history"));
const selectedHistoryPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Recent exports") && String(step?.expression || "").includes("demo-export-artifact-selected-saved-view-history"));
const reopenSavedViewIndex = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Reopen in builder")[1] ?? -1;
const reopenedSavedViewNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Saved View"));
const reopenedSavedViewActionStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened ReportDocument: Capacity Trend Q3 Saved View") && String(step?.expression || "").includes("Inspect export"));
const inspectReopenedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened saved-view section."));
const reopenedExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened export request summary") && String(step?.expression || "").includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"'));
const injectExportBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("preview export behavior api not available") && String(step?.expression || "").includes("demo-export-artifact-reopened-saved-view-pinned"));
const submitReopenedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Export snapshot button not found in reopened saved-view section."));
const acceptedExportIndex = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Saved View."))[1] ?? -1;
const refreshStatusIndex = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Refresh status")[1] ?? -1;
const succeededExportIndex = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Export demo-export-job-1 is succeeded."))[1] ?? -1;
const pinnedArtifactSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-reopened-saved-view-pinned"));
const historyPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Recent exports") && String(step?.expression || "").includes("Current export selection") && String(step?.expression || "").includes("demo-export-artifact-reopened-saved-view-pinned"));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Saved View.pdf'"));
const downloadedArtifactPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("%PDF-pinned reopened saved-view saved_view_capacityTrendQ3"));

assert.notEqual(selectedSavedViewIndex, -1);
assert.notEqual(switchToPublishedIndex, -1);
assert.notEqual(selectedPublishedIndex, -1);
assert.notEqual(reopenPublishedIndex, -1);
assert.notEqual(noteMutationIndex, -1);
assert.notEqual(switchBackToSavedViewIndex, -1);
assert.notEqual(selectedSavedViewAgainIndex, -1);
assert.notEqual(prepareSavedViewResponseIndex, -1);
assert.notEqual(savedViewResponseSummaryIndex, -1);
assert.notEqual(savedViewExportSummaryIndex, -1);
assert.notEqual(injectSelectedExportBehaviorIndex, -1);
assert.notEqual(submitSelectedExportIndex, -1);
assert.notEqual(acceptedSelectedExportIndex, -1);
assert.notEqual(refreshSelectedExportIndex, -1);
assert.notEqual(selectedPinnedArtifactSummaryIndex, -1);
assert.notEqual(selectedHistoryPanelIndex, -1);
assert.notEqual(reopenSavedViewIndex, -1);
assert.notEqual(reopenedSavedViewNoticeIndex, -1);
assert.notEqual(reopenedSavedViewActionStateIndex, -1);
assert.notEqual(inspectReopenedExportIndex, -1);
assert.notEqual(reopenedExportSummaryIndex, -1);
assert.notEqual(injectExportBehaviorIndex, -1);
assert.notEqual(submitReopenedExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(refreshStatusIndex, -1);
assert.notEqual(succeededExportIndex, -1);
assert.notEqual(pinnedArtifactSummaryIndex, -1);
assert.notEqual(historyPanelIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(downloadedArtifactIndex, -1);
assert.notEqual(downloadedArtifactPayloadIndex, -1);

assert.equal(selectedSavedViewIndex < switchToPublishedIndex, true);
assert.equal(switchToPublishedIndex < selectedPublishedIndex, true);
assert.equal(selectedPublishedIndex < reopenPublishedIndex, true);
assert.equal(reopenPublishedIndex < noteMutationIndex, true);
assert.equal(noteMutationIndex < switchBackToSavedViewIndex, true);
assert.equal(switchBackToSavedViewIndex < selectedSavedViewAgainIndex, true);
assert.equal(selectedSavedViewAgainIndex < prepareSavedViewResponseIndex, true);
assert.equal(prepareSavedViewResponseIndex < savedViewResponseSummaryIndex, true);
assert.equal(savedViewResponseSummaryIndex < savedViewExportSummaryIndex, true);
assert.equal(savedViewExportSummaryIndex < injectSelectedExportBehaviorIndex, true);
assert.equal(injectSelectedExportBehaviorIndex < submitSelectedExportIndex, true);
assert.equal(submitSelectedExportIndex < acceptedSelectedExportIndex, true);
assert.equal(acceptedSelectedExportIndex < refreshSelectedExportIndex, true);
assert.equal(refreshSelectedExportIndex < selectedPinnedArtifactSummaryIndex, true);
assert.equal(selectedPinnedArtifactSummaryIndex < selectedHistoryPanelIndex, true);
assert.equal(selectedHistoryPanelIndex < reopenSavedViewIndex, true);
assert.equal(reopenSavedViewIndex < reopenedSavedViewNoticeIndex, true);
assert.equal(reopenedSavedViewNoticeIndex < reopenedSavedViewActionStateIndex, true);
assert.equal(reopenedSavedViewActionStateIndex < inspectReopenedExportIndex, true);
assert.equal(inspectReopenedExportIndex < reopenedExportSummaryIndex, true);
assert.equal(reopenedExportSummaryIndex < injectExportBehaviorIndex, true);
assert.equal(injectExportBehaviorIndex < submitReopenedExportIndex, true);
assert.equal(submitReopenedExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < refreshStatusIndex, true);
assert.equal(refreshStatusIndex < succeededExportIndex, true);
assert.equal(succeededExportIndex < pinnedArtifactSummaryIndex, true);
assert.equal(pinnedArtifactSummaryIndex < historyPanelIndex, true);
assert.equal(historyPanelIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < downloadedArtifactIndex, true);
assert.equal(downloadedArtifactIndex < downloadedArtifactPayloadIndex, true);

console.log("report-builder-preview-list-entry-saved-view-mismatched-reopened-session-scenario-assets ✓ selected, reopened, and reopened-export saved-view surfaces stay pinned to the saved-view source when a same-report published snapshot is reopened and mutated");
