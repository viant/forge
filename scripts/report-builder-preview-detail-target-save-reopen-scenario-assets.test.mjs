import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-save-reopen-preserve-mappings.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("channel-detail-modal") && expression.includes("source: 'archived'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 21")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state.drillMetadata.detailTargets.length === 1")),
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
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("detail-target-save-reopen-preserve-mappings")),
  true,
);

const seedStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState"));
const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const draftDiscardedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Draft discarded."));
const waitLocalDraftClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Local Draft"));
const waitStandaloneClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("panels.length >= 1") && String(step?.expression || "").includes("every((entry) => !!entry.closest('.forge-report-builder__runtime-preview'))"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 21"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("archived")') && String(step?.expression || "").includes('!runtimeText.includes("Failed to resolve detail target")'));

assert.notEqual(seedStateIndex, -1);
assert.notEqual(beginDraftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(discardDraftIndex, -1);
assert.notEqual(draftDiscardedIndex, -1);
assert.notEqual(waitLocalDraftClearedIndex, -1);
assert.notEqual(waitStandaloneClearedIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(seedStateIndex < beginDraftIndex, true);
assert.equal(beginDraftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < discardDraftIndex, true);
assert.equal(discardDraftIndex < draftDiscardedIndex, true);
assert.equal(draftDiscardedIndex < waitLocalDraftClearedIndex, true);
assert.equal(waitLocalDraftClearedIndex < waitStandaloneClearedIndex, true);
assert.equal(waitStandaloneClearedIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-save-reopen-scenario-assets ✓ preview scenario covers save/get/reopen persistence for authored detail-target mappings");
