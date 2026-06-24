import assert from "node:assert/strict";

import detailTargetImportSavedPayloadScenario from "../tests/report-builder-preview-semantic-import-detail-target-saved-report-payload.scenario.mjs";

assert.equal(detailTargetImportSavedPayloadScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(detailTargetImportSavedPayloadScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(detailTargetImportSavedPayloadScenario.steps), true);
assert.ok(detailTargetImportSavedPayloadScenario.steps.length > 10);

const expressions = detailTargetImportSavedPayloadScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return detailTargetImportSavedPayloadScenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("detail-target.saved-report-payload.json")),
  true,
);
assert.equal(
  detailTargetImportSavedPayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report payload Imported Detail Target Modal Demo.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("1 detail target") && expression.includes("1 field action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("importedDetailTargetModalDemo") && expression.includes("documentVersion === 24")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('target.navigationMode !== "modal"') && expression.includes('target.parameters?.source === "archived"')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState API not available for mutation.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes('text.includes("archived")')),
  true,
);
assert.equal(
  detailTargetImportSavedPayloadScenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  detailTargetImportSavedPayloadScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-detail-target-saved-report-payload")),
  true,
);

const importIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail-target.saved-report-payload.json"));
const waitSavedPayloadIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Saved report payload: Imported Detail Target Modal Demo"));
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const mutateStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState API not available for mutation."));
const verifyMutatedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode === "hostRoute"'));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 24"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("archived")') && String(step?.expression || "").includes('!runtimeText.includes("Failed to resolve detail target")'));

assert.notEqual(importIndex, -1);
assert.notEqual(waitSavedPayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(mutateStateIndex, -1);
assert.notEqual(verifyMutatedStateIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(importIndex < waitSavedPayloadIndex, true);
assert.equal(waitSavedPayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < mutateStateIndex, true);
assert.equal(mutateStateIndex < verifyMutatedStateIndex, true);
assert.equal(verifyMutatedStateIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-import-saved-payload-scenario-assets ✓ imported saved-report-payload scenario preserves authored detail-target mappings through reopen");
