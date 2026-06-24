import assert from "node:assert/strict";

import detailTargetImportScenario from "../tests/report-builder-preview-semantic-import-detail-target-saved-report-record.scenario.mjs";

assert.equal(detailTargetImportScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(detailTargetImportScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(detailTargetImportScenario.steps), true);
assert.ok(detailTargetImportScenario.steps.length > 8);

const expressions = detailTargetImportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return detailTargetImportScenario.steps.findIndex(predicate);
}

function findStepIndices(predicate) {
  return detailTargetImportScenario.steps
    .map((step, index) => (predicate(step) ? index : -1))
    .filter((index) => index >= 0);
}

assert.equal(
  expressions.some((expression) => expression.includes("buildReportBuilderDetailTargetImportedArtifactFixtureState") && expression.includes("detail-target.saved-report-record.json")),
  true,
);
assert.equal(
  detailTargetImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready.")),
  true,
);
assert.equal(
  detailTargetImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Secondary Imported Detail Target Demo. Reopen in builder is ready.")),
  true,
);
assert.equal(
  detailTargetImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report records")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Secondary Imported Detail Target Demo") && expression.includes("2 records") && expression.includes("1 detail target") && expression.includes("1 field action")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Imported Detail Target Modal Demo Use button not found.") && expression.includes('text === "Use"') && expression.includes('title === "Imported Detail Target Modal Demo"') && expression.includes("firstElementChild")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState API not available for mutation.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  detailTargetImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported Detail Target Modal Demo is now the active saved report record.")),
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
  detailTargetImportScenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  detailTargetImportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-detail-target-saved-report-record")),
  true,
);

const importIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("buildReportBuilderDetailTargetImportedArtifactFixtureState"));
const waitImportedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported saved report record Imported Detail Target Modal Demo. Reopen in builder is ready."));
const importSecondaryIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("secondary-detail-target.saved-report-record.json"));
const waitSecondaryImportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported saved report record Secondary Imported Detail Target Demo. Reopen in builder is ready."));
const mutateStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState API not available for mutation."));
const verifyMutatedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode === "hostRoute"'));
const useImportedIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Imported Detail Target Modal Demo Use button not found."));
const waitActiveSavedRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported Detail Target Modal Demo is now the active saved report record."));
const waitGetIndices = findStepIndices((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Imported Detail Target Modal Demo"));
const waitGetIndex = waitGetIndices[waitGetIndices.length - 1] ?? -1;
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("target://example/performance/channel-detail-modal")') && String(step?.expression || "").includes('text.includes("archived")'));

assert.notEqual(importIndex, -1);
assert.notEqual(waitImportedIndex, -1);
assert.notEqual(importSecondaryIndex, -1);
assert.notEqual(waitSecondaryImportIndex, -1);
assert.notEqual(mutateStateIndex, -1);
assert.notEqual(verifyMutatedStateIndex, -1);
assert.notEqual(useImportedIndex, -1);
assert.notEqual(waitActiveSavedRecordIndex, -1);
assert.notEqual(waitGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(importIndex < waitImportedIndex, true);
assert.equal(waitImportedIndex < importSecondaryIndex, true);
assert.equal(importSecondaryIndex < waitSecondaryImportIndex, true);
assert.equal(waitSecondaryImportIndex < mutateStateIndex, true);
assert.equal(mutateStateIndex < verifyMutatedStateIndex, true);
assert.equal(verifyMutatedStateIndex < useImportedIndex, true);
assert.equal(useImportedIndex < waitActiveSavedRecordIndex, true);
assert.equal(waitActiveSavedRecordIndex < waitGetIndex, true);
assert.equal(waitGetIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-import-scenario-assets ✓ imported saved-report-record scenario preserves authored detail-target mappings through reopen");
