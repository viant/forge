import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-entry-published-snapshot-mismatched-reopened-session.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Trend Q3 Saved View for editing.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse API not available.") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replacePreparedListReportDocumentsResponse API not available.") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Saved View Runtime Note") && expression.includes("should stay isolated")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Get ReportDocument response summary"]') && expression.includes('"kind": "reportBuilder.publishedSnapshot"') && expression.includes('"sourceArtifactId": "published_snapshot_capacityTrendQ3"') && expression.includes("!text.includes(")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"') && expression.includes("!raw.includes(")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview export behavior api not available") && expression.includes("demo-export-artifact-selected-published-snapshot-history") && expression.includes("reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-selected-published-snapshot-history") && expression.includes("!text.includes('demo-export-artifact-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Recent exports") && expression.includes("Current export selection") && expression.includes("demo-export-artifact-selected-published-snapshot-history") && expression.includes("!text.includes('demo-export-artifact-reopened-saved-view-pinned')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("published_snapshot_capacityTrendQ3") && expression.includes("saved_view_capacityTrendQ3") && expression.includes("Inspect export") && expression.includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Inspect export button not found in reopened published-snapshot section.") && expression.includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopened export request summary") && expression.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"') && expression.includes("!raw.includes(")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("preview export behavior api not available") && expression.includes("demo-export-artifact-reopened-published-snapshot-pinned") && expression.includes("reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-reopened-published-snapshot-pinned") && expression.includes("!text.includes('demo-export-artifact-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Recent exports") && expression.includes("Current export selection") && expression.includes("demo-export-artifact-reopened-published-snapshot-pinned") && expression.includes("!text.includes('demo-export-artifact-reopened-saved-view-pinned')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Published Snapshot.pdf'") && expression.includes("payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType === 'application/pdf'") && expression.includes("%PDF-pinned reopened published-snapshot published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-entry-published-snapshot-mismatched-reopened-session")),
  true,
);

const selectedPublishedSnapshotIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const selectedPublishedSnapshotIndex = selectedPublishedSnapshotIndexes[0] ?? -1;
const replacePreparedResponseIndexes = findStepIndexes((step) => step?.type === "eval" && String(step?.expression || "").includes("replacePreparedListReportDocumentsResponse API not available."));
const switchToSavedViewIndex = replacePreparedResponseIndexes[0] ?? -1;
const selectedSavedViewIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const reopenSavedViewIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const noteMutationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Saved View Runtime Note") && String(step?.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const switchBackToPublishedSnapshotIndex = replacePreparedResponseIndexes[1] ?? -1;
const selectedPublishedSnapshotAgainIndex = selectedPublishedSnapshotIndexes[1] ?? -1;
const prepareSelectedResponseIndexes = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const preparePublishedSnapshotResponseIndex = prepareSelectedResponseIndexes[1] ?? -1;
const publishedSnapshotResponseSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label="Get ReportDocument response summary"]'));
const publishedSnapshotExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected list entry export request summary") && String(step?.expression || "").includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"'));
const injectSelectedExportBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("demo-export-artifact-selected-published-snapshot-history"));
const submitSelectedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Selected list entry export submit button not found"));
const acceptedSelectedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot."));
const refreshSelectedExportIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const selectedPinnedArtifactSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-selected-published-snapshot-history"));
const selectedHistoryPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Recent exports") && String(step?.expression || "").includes("demo-export-artifact-selected-published-snapshot-history"));
const reopenPublishedSnapshotIndex = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Reopen in builder")[1] ?? -1;
const reopenedPublishedSnapshotNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot"));
const reopenedPublishedSnapshotActionStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot") && String(step?.expression || "").includes("Inspect export"));
const inspectReopenedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Inspect export button not found in reopened published-snapshot section."));
const reopenedExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Reopened export request summary") && String(step?.expression || "").includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3"'));
const injectExportBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("preview export behavior api not available") && String(step?.expression || "").includes("demo-export-artifact-reopened-published-snapshot-pinned"));
const submitReopenedExportIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Export snapshot button not found in reopened published-snapshot section."));
const acceptedExportIndex = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Accepted PDF export for Capacity Trend Q3 Published Snapshot."))[1] ?? -1;
const refreshStatusIndex = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Refresh status")[1] ?? -1;
const succeededExportIndex = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Export demo-export-job-1 is succeeded."))[1] ?? -1;
const pinnedArtifactSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("demo-export-artifact-reopened-published-snapshot-pinned"));
const historyPanelIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Recent exports") && String(step?.expression || "").includes("Current export selection") && String(step?.expression || "").includes("demo-export-artifact-reopened-published-snapshot-pinned"));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("window.__artifactDownloadCapture.filename === 'Capacity Trend Q3 Published Snapshot.pdf'"));
const downloadedArtifactPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("%PDF-pinned reopened published-snapshot published_snapshot_capacityTrendQ3"));

assert.notEqual(selectedPublishedSnapshotIndex, -1);
assert.notEqual(switchToSavedViewIndex, -1);
assert.notEqual(selectedSavedViewIndex, -1);
assert.notEqual(reopenSavedViewIndex, -1);
assert.notEqual(noteMutationIndex, -1);
assert.notEqual(switchBackToPublishedSnapshotIndex, -1);
assert.notEqual(selectedPublishedSnapshotAgainIndex, -1);
assert.notEqual(preparePublishedSnapshotResponseIndex, -1);
assert.notEqual(publishedSnapshotResponseSummaryIndex, -1);
assert.notEqual(publishedSnapshotExportSummaryIndex, -1);
assert.notEqual(injectSelectedExportBehaviorIndex, -1);
assert.notEqual(submitSelectedExportIndex, -1);
assert.notEqual(acceptedSelectedExportIndex, -1);
assert.notEqual(refreshSelectedExportIndex, -1);
assert.notEqual(selectedPinnedArtifactSummaryIndex, -1);
assert.notEqual(selectedHistoryPanelIndex, -1);
assert.notEqual(reopenPublishedSnapshotIndex, -1);
assert.notEqual(reopenedPublishedSnapshotNoticeIndex, -1);
assert.notEqual(reopenedPublishedSnapshotActionStateIndex, -1);
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

assert.equal(selectedPublishedSnapshotIndex < switchToSavedViewIndex, true);
assert.equal(switchToSavedViewIndex < selectedSavedViewIndex, true);
assert.equal(selectedSavedViewIndex < reopenSavedViewIndex, true);
assert.equal(reopenSavedViewIndex < noteMutationIndex, true);
assert.equal(noteMutationIndex < switchBackToPublishedSnapshotIndex, true);
assert.equal(switchBackToPublishedSnapshotIndex < selectedPublishedSnapshotAgainIndex, true);
assert.equal(selectedPublishedSnapshotAgainIndex < preparePublishedSnapshotResponseIndex, true);
assert.equal(preparePublishedSnapshotResponseIndex < publishedSnapshotResponseSummaryIndex, true);
assert.equal(publishedSnapshotResponseSummaryIndex < publishedSnapshotExportSummaryIndex, true);
assert.equal(publishedSnapshotExportSummaryIndex < injectSelectedExportBehaviorIndex, true);
assert.equal(injectSelectedExportBehaviorIndex < submitSelectedExportIndex, true);
assert.equal(submitSelectedExportIndex < acceptedSelectedExportIndex, true);
assert.equal(acceptedSelectedExportIndex < refreshSelectedExportIndex, true);
assert.equal(refreshSelectedExportIndex < selectedPinnedArtifactSummaryIndex, true);
assert.equal(selectedPinnedArtifactSummaryIndex < selectedHistoryPanelIndex, true);
assert.equal(selectedHistoryPanelIndex < reopenPublishedSnapshotIndex, true);
assert.equal(reopenPublishedSnapshotIndex < reopenedPublishedSnapshotNoticeIndex, true);
assert.equal(reopenedPublishedSnapshotNoticeIndex < reopenedPublishedSnapshotActionStateIndex, true);
assert.equal(reopenedPublishedSnapshotActionStateIndex < inspectReopenedExportIndex, true);
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

console.log("report-builder-preview-list-entry-published-snapshot-mismatched-reopened-session-scenario-assets ✓ selected, reopened, and reopened-export published-snapshot surfaces stay pinned to the published-snapshot source when a same-report saved view is reopened and mutated");
