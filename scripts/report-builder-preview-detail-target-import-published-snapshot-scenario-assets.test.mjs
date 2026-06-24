import assert from "node:assert/strict";

import detailTargetImportPublishedSnapshotScenario from "../tests/report-builder-preview-semantic-import-detail-target-published-snapshot.scenario.mjs";

assert.equal(detailTargetImportPublishedSnapshotScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(detailTargetImportPublishedSnapshotScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(detailTargetImportPublishedSnapshotScenario.steps), true);
assert.ok(detailTargetImportPublishedSnapshotScenario.steps.length > 10);

const expressions = detailTargetImportPublishedSnapshotScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return detailTargetImportPublishedSnapshotScenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("buildReportBuilderDetailTargetImportedArtifactFixtureState") && expression.includes("fixture.publishedSnapshotArtifact") && expression.includes("detail-target.published-snapshot.json")),
  true,
);
assert.equal(
  detailTargetImportPublishedSnapshotScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported published snapshot Imported Detail Target Modal Published Snapshot. Reopen and export are ready.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Imported Detail Target Modal Published Snapshot") && expression.includes("published-snapshot artifact") && expression.includes("1 detail target") && expression.includes("1 field action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState API not available for mutation.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Imported Detail Target Modal Published Snapshot Use button not found.") && expression.includes('text === "Use"') && expression.includes('title === "Imported Detail Target Modal Published Snapshot"') && expression.includes("firstElementChild")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("importedDetailTargetModalDemo") && expression.includes("documentVersion === 25")),
  true,
);
assert.equal(
  detailTargetImportPublishedSnapshotScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported Detail Target Modal Published Snapshot is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('target.navigationMode !== "modal"') && expression.includes('target.parameters?.source === "archived"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes('text.includes("archived")')),
  true,
);
assert.equal(
  detailTargetImportPublishedSnapshotScenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  detailTargetImportPublishedSnapshotScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-detail-target-published-snapshot")),
  true,
);

const importIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("fixture.publishedSnapshotArtifact"));
const waitImportedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported published snapshot Imported Detail Target Modal Published Snapshot. Reopen and export are ready."));
const mutateStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState API not available for mutation."));
const verifyMutatedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode === "hostRoute"'));
const useImportedIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Imported Detail Target Modal Published Snapshot Use button not found."));
const waitActiveSavedRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported Detail Target Modal Published Snapshot is now the active saved report record."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 25"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("archived")') && String(step?.expression || "").includes('!runtimeText.includes("Failed to resolve detail target")'));

assert.notEqual(importIndex, -1);
assert.notEqual(waitImportedIndex, -1);
assert.notEqual(mutateStateIndex, -1);
assert.notEqual(verifyMutatedStateIndex, -1);
assert.notEqual(useImportedIndex, -1);
assert.notEqual(waitActiveSavedRecordIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(importIndex < waitImportedIndex, true);
assert.equal(waitImportedIndex < mutateStateIndex, true);
assert.equal(mutateStateIndex < verifyMutatedStateIndex, true);
assert.equal(verifyMutatedStateIndex < useImportedIndex, true);
assert.equal(useImportedIndex < waitActiveSavedRecordIndex, true);
assert.equal(waitActiveSavedRecordIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-import-published-snapshot-scenario-assets ✓ imported published-snapshot scenario restores authored detail-target mappings through reopen");
