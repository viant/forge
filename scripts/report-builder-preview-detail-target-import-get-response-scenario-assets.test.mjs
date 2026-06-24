import assert from "node:assert/strict";

import detailTargetImportGetResponseScenario from "../tests/report-builder-preview-semantic-import-detail-target-get-response.scenario.mjs";

assert.equal(detailTargetImportGetResponseScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(detailTargetImportGetResponseScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(detailTargetImportGetResponseScenario.steps), true);
assert.ok(detailTargetImportGetResponseScenario.steps.length > 10);

const expressions = detailTargetImportGetResponseScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return detailTargetImportGetResponseScenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("buildReportBuilderDetailTargetImportedArtifactFixtureState") && expression.includes("detail-target.get-report-document-response.json")),
  true,
);
assert.equal(
  detailTargetImportGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported getReportDocument response Imported Detail Target Modal Demo.")),
  true,
);
assert.equal(
  detailTargetImportGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported getReportDocument response Secondary Imported Detail Target Demo.")),
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
  detailTargetImportGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported Detail Target Modal Demo is now the active local get response.")),
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
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail-modal") && expression.includes('text.includes("archived")')),
  true,
);
assert.equal(
  detailTargetImportGetResponseScenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  detailTargetImportGetResponseScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-detail-target-get-response")),
  true,
);

const importPrimaryIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail-target.get-report-document-response.json"));
const waitPrimaryImportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported getReportDocument response Imported Detail Target Modal Demo."));
const importSecondaryIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("secondary-detail-target.get-response.json"));
const waitSecondaryImportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported getReportDocument response Secondary Imported Detail Target Demo."));
const mutateStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState API not available for mutation."));
const verifyMutatedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode === "hostRoute"'));
const useImportedIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Imported Detail Target Modal Demo Use button not found."));
const waitActiveResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported Detail Target Modal Demo is now the active local get response."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 24"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('target.navigationMode !== "modal"') && String(step?.expression || "").includes('target.parameters?.source === "archived"'));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("archived")') && String(step?.expression || "").includes('!runtimeText.includes("Failed to resolve detail target")'));

assert.notEqual(importPrimaryIndex, -1);
assert.notEqual(waitPrimaryImportIndex, -1);
assert.notEqual(importSecondaryIndex, -1);
assert.notEqual(waitSecondaryImportIndex, -1);
assert.notEqual(mutateStateIndex, -1);
assert.notEqual(verifyMutatedStateIndex, -1);
assert.notEqual(useImportedIndex, -1);
assert.notEqual(waitActiveResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyReopenedStateIndex, -1);
assert.notEqual(clickRuntimeActionIndex, -1);
assert.notEqual(verifyHostIntentIndex, -1);

assert.equal(importPrimaryIndex < waitPrimaryImportIndex, true);
assert.equal(waitPrimaryImportIndex < importSecondaryIndex, true);
assert.equal(importSecondaryIndex < waitSecondaryImportIndex, true);
assert.equal(waitSecondaryImportIndex < mutateStateIndex, true);
assert.equal(mutateStateIndex < verifyMutatedStateIndex, true);
assert.equal(verifyMutatedStateIndex < useImportedIndex, true);
assert.equal(useImportedIndex < waitActiveResponseIndex, true);
assert.equal(waitActiveResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyReopenedStateIndex, true);
assert.equal(verifyReopenedStateIndex < clickRuntimeActionIndex, true);
assert.equal(clickRuntimeActionIndex < verifyHostIntentIndex, true);

console.log("report-builder-preview-detail-target-import-get-response-scenario-assets ✓ imported local reopenable activation preserves authored detail-target mappings through reopen");
