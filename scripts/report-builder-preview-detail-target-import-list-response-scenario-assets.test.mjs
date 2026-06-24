import assert from "node:assert/strict";

import detailTargetImportListResponseScenario from "../tests/report-builder-preview-semantic-import-detail-target-list-response.scenario.mjs";

assert.equal(detailTargetImportListResponseScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(detailTargetImportListResponseScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(detailTargetImportListResponseScenario.steps), true);
assert.ok(detailTargetImportListResponseScenario.steps.length > 12);

const expressions = detailTargetImportListResponseScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return detailTargetImportListResponseScenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("buildReportBuilderDetailTargetImportedArtifactFixtureState") && expression.includes("detail-target.saved-report-record.json")),
  true,
);
assert.equal(
  detailTargetImportListResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready.")),
  true,
);
assert.equal(
  detailTargetImportListResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported listReportDocuments response with 1 entry.")),
  true,
);
assert.equal(
  detailTargetImportListResponseScenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("No local payload backing")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("importedDetailTargetModalDemo") && expression.includes("documentVersion === 24")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState API not available for mutation.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('target.navigationMode !== "modal"') && expression.includes('target.parameters?.source === "archived"') && expression.includes('detailTargets.some((detailTarget) => detailTarget.targetRef === "target://example/performance/channel-detail")') && expression.includes('fieldAction.actions.some((action) => action.targetRef === "target://example/performance/channel-detail")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes('text.includes("archived")')),
  true,
);
assert.equal(
  detailTargetImportListResponseScenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  detailTargetImportListResponseScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-detail-target-list-response")),
  true,
);

const importSavedRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail-target.saved-report-record.json"));
const waitSavedRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready."));
const importListResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail-target.list-response.json"));
const waitListResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported listReportDocuments response with 1 entry."));
const mutateStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState API not available for mutation."));
const verifyMutatedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode === "hostRoute"'));
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const openSelectedIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 24"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"') && String(step?.expression || "").includes('detailTargets.some((detailTarget) => detailTarget.targetRef === "target://example/performance/channel-detail")') && String(step?.expression || "").includes('fieldAction.actions.some((action) => action.targetRef === "target://example/performance/channel-detail")'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("archived")') && String(step?.expression || "").includes('!runtimeText.includes("Failed to resolve detail target")'));

assert.notEqual(importSavedRecordIndex, -1);
assert.notEqual(waitSavedRecordIndex, -1);
assert.notEqual(importListResponseIndex, -1);
assert.notEqual(waitListResponseIndex, -1);
assert.notEqual(mutateStateIndex, -1);
assert.notEqual(verifyMutatedStateIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(openSelectedIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(importSavedRecordIndex < waitSavedRecordIndex, true);
assert.equal(waitSavedRecordIndex < importListResponseIndex, true);
assert.equal(importListResponseIndex < waitListResponseIndex, true);
assert.equal(waitListResponseIndex < mutateStateIndex, true);
assert.equal(mutateStateIndex < verifyMutatedStateIndex, true);
assert.equal(verifyMutatedStateIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < openSelectedIndex, true);
assert.equal(openSelectedIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-import-list-response-scenario-assets ✓ imported list-response selected-get reopen preserves authored detail-target mappings");
