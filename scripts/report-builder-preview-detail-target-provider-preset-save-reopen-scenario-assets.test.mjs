import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-preset-save-reopen.scenario.mjs";

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

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig") && expression.includes("drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] }")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft") && expression.includes("__scenarioProviderPresetDraft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("titleInput.value === 'Show channel details'") && expression.includes("parameterLabels.some")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("routePreset.options") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("detailTarget.parameters?.campaign === '$row.campaign'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/channel-detail") && expression.includes("text.includes('Prospect Sprint')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save artifact"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare report payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Discard draft"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Reopen in builder"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 31")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-preset-save-reopen")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig"));
const waitPresetOptionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("routePreset.options") && String(step?.expression || "").includes("target://example/performance/channel-detail"));
const selectPresetIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Route preset select not found"));
const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const draftDiscardedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Draft discarded."));
const waitLocalDraftClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Local Draft"));
const waitStandaloneClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("panels.length >= 1") && String(step?.expression || "").includes("every((entry) => !!entry.closest('.forge-report-builder__runtime-preview'))"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 31"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.campaign === '$row.campaign'") && String(step?.expression || "").includes("fieldAction.actions"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const verifyHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("text.includes('Prospect Sprint')")
  && String(step?.expression || "").includes("!runtimeText.includes('Detail target resolved with omitted parameters: channel.')")
  && String(step?.expression || "").includes("!runtimeText.includes('Failed to resolve detail target')"));

assert.notEqual(patchConfigIndex, -1);
assert.notEqual(waitPresetOptionIndex, -1);
assert.notEqual(selectPresetIndex, -1);
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

assert.equal(patchConfigIndex < waitPresetOptionIndex, true);
assert.equal(waitPresetOptionIndex < selectPresetIndex, true);
assert.equal(selectPresetIndex < beginDraftIndex, true);
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

console.log("report-builder-preview-detail-target-provider-preset-save-reopen-scenario-assets ✓ provider-backed presets persist through save/get/reopen with explicit reopened-session identity and scoped runtime execution");
