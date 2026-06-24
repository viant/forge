import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-chart-date-save-reopen.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceCollectionRows") && expression.includes("2026-05-01")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft") && expression.includes("__scenarioProviderChartDateDraft")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("detailTarget.parameters?.eventDate === '$value'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("target://example/performance/date-detail") && expression.includes('text.includes("2026-05-01")') && expression.includes('text.includes("country")') && expression.includes('text.includes("US")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('document.querySelectorAll(".forge-report-runtime-host-intent")') && expression.includes("target://example/performance/date-detail") && expression.includes('text.includes("country")') && expression.includes('text.includes("US")') && expression.includes('!text.includes("No detail target resolved")') && expression.includes('!text.includes("Failed to resolve detail target")')),
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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 41")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "eval" && String(step?.expression || "").includes("Reopened standalone runtime Show date details action not found.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-chart-date-save-reopen")),
  true,
);

const patchConfigIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig"));
const beginDraftIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const draftDiscardedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Draft discarded."));
const waitLocalDraftClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Local Draft"));
const waitStandaloneClearedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("panels.length >= 1") && String(step?.expression || "").includes("every((entry) => !!entry.closest('.forge-report-builder__runtime-preview'))"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 41"));
const verifyReopenedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("detailTarget.parameters?.eventDate === '$value'"));
const clickRuntimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details");
const waitResolvedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Resolved detail target"));
const verifyPreviewHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent")
  && String(step?.expression || "").includes('text.includes("country")')
  && String(step?.expression || "").includes('text.includes("US")'));
const dismissPreviewIntentIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Preview dismiss intent button not found."));
const waitPreviewDismissedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes("== null"));
const waitStandalonePanelReadyIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes("panels.length >= 1")
  && String(step?.expression || "").includes('querySelectorAll(".recharts-bar-rectangle").length >= 1'));
const clickStandaloneMarkIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Reopened standalone runtime chart mark not found."));
const waitStandaloneSelectionIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes('!entry.closest(".forge-report-builder__runtime-preview")')
  && String(step?.expression || "").includes("Selected value:")
  && String(step?.expression || "").includes("Show date details"));
const clickStandaloneActionIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Reopened standalone runtime Show date details action not found."));
const verifyStandaloneHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes('document.querySelectorAll(".forge-report-runtime-host-intent")')
  && String(step?.expression || "").includes("target://example/performance/date-detail")
  && String(step?.expression || "").includes('text.includes("country")')
  && String(step?.expression || "").includes('text.includes("US")')
  && String(step?.expression || "").includes('!text.includes("No detail target resolved")')
  && String(step?.expression || "").includes('!text.includes("Failed to resolve detail target")'));

assert.notEqual(patchConfigIndex, -1);
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
assert.notEqual(waitResolvedIndex, -1);
assert.notEqual(verifyPreviewHostIntentIndex, -1);
assert.notEqual(dismissPreviewIntentIndex, -1);
assert.notEqual(waitPreviewDismissedIndex, -1);
assert.notEqual(waitStandalonePanelReadyIndex, -1);
assert.notEqual(clickStandaloneMarkIndex, -1);
assert.notEqual(waitStandaloneSelectionIndex, -1);
assert.notEqual(clickStandaloneActionIndex, -1);
assert.notEqual(verifyStandaloneHostIntentIndex, -1);

assert.equal(patchConfigIndex < beginDraftIndex, true);
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
assert.equal(clickRuntimeActionIndex < waitResolvedIndex, true);
assert.equal(waitResolvedIndex < verifyPreviewHostIntentIndex, true);
assert.equal(verifyPreviewHostIntentIndex < dismissPreviewIntentIndex, true);
assert.equal(dismissPreviewIntentIndex < waitPreviewDismissedIndex, true);
assert.equal(waitPreviewDismissedIndex < waitStandalonePanelReadyIndex, true);
assert.equal(waitStandalonePanelReadyIndex < clickStandaloneMarkIndex, true);
assert.equal(clickStandaloneMarkIndex < waitStandaloneSelectionIndex, true);
assert.equal(waitStandaloneSelectionIndex < clickStandaloneActionIndex, true);
assert.equal(clickStandaloneActionIndex < verifyStandaloneHostIntentIndex, true);

console.log("report-builder-preview-detail-target-provider-chart-date-save-reopen-scenario-assets ✓ provider-backed chart date detail preserves preview and standalone runtime parity through save/get/reopen");
