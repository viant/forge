import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-provider-chart-date-save-reopen.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("capacityKpiBlendByDateQ3") && expression.includes("capacity-kpi-blend-provider-date.saved-report-payload.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("drillMetadata: { hierarchies: [], detailTargets: [], fieldActions: [] }")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report payload Capacity KPI Blend Q3.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Capacity KPI Blend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Reopen in builder"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityKpiBlendByDateQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("state.drillMetadata.detailTargets.length === 0") && expression.includes("config.drillMetadata.detailTargets.length === 0")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceCollectionRows") && expression.includes("2026-05-01")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && expression.includes('text.includes("country")') && expression.includes('text.includes("US")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('document.querySelectorAll(".forge-report-runtime-host-intent")') && expression.includes("target://example/performance/date-detail") && expression.includes('text.includes("country")') && expression.includes('text.includes("US")') && expression.includes('!text.includes("No detail target resolved")') && expression.includes('!text.includes("Failed to resolve detail target")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-provider-chart-date-save-reopen")),
  true,
);

const importArtifactIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("capacity-kpi-blend-provider-date.saved-report-payload.json"));
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const waitNoLocalDraftIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Local Draft"));
const waitNoStandaloneBeforeReopenIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("panels.length >= 1") && String(step?.expression || "").includes("every((entry) => !!entry.closest('.forge-report-builder__runtime-preview'))"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const verifyHydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 11"));
const verifyClearedDrillMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("state.drillMetadata.detailTargets.length === 0") && String(step?.expression || "").includes("config.drillMetadata.detailTargets.length === 0"));
const clickPreviewDetailIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show date details");
const verifyPreviewHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent") && String(step?.expression || "").includes('text.includes("country")') && String(step?.expression || "").includes('text.includes("US")'));
const dismissPreviewIntentIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Preview dismiss intent button not found."));
const clickStandaloneMarkIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Imported reopened standalone runtime chart mark not found."));
const clickStandaloneDetailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Imported reopened standalone Show date details action not found."));
const verifyStandaloneHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes('document.querySelectorAll(".forge-report-runtime-host-intent")')
  && String(step?.expression || "").includes("target://example/performance/date-detail")
  && String(step?.expression || "").includes('text.includes("country")')
  && String(step?.expression || "").includes('text.includes("US")')
  && String(step?.expression || "").includes('!text.includes("No detail target resolved")')
  && String(step?.expression || "").includes('!text.includes("Failed to resolve detail target")'));

assert.notEqual(importArtifactIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(waitNoLocalDraftIndex, -1);
assert.notEqual(waitNoStandaloneBeforeReopenIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(verifyHydratedSessionIndex, -1);
assert.notEqual(verifyClearedDrillMetadataIndex, -1);
assert.notEqual(clickPreviewDetailIndex, -1);
assert.notEqual(verifyPreviewHostIntentIndex, -1);
assert.notEqual(dismissPreviewIntentIndex, -1);
assert.notEqual(clickStandaloneMarkIndex, -1);
assert.notEqual(clickStandaloneDetailIndex, -1);
assert.notEqual(verifyStandaloneHostIntentIndex, -1);

assert.equal(importArtifactIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < waitNoLocalDraftIndex, true);
assert.equal(waitNoLocalDraftIndex < waitNoStandaloneBeforeReopenIndex, true);
assert.equal(waitNoStandaloneBeforeReopenIndex < reopenIndex, true);
assert.equal(reopenIndex < verifyHydratedSessionIndex, true);
assert.equal(verifyHydratedSessionIndex < verifyClearedDrillMetadataIndex, true);
assert.equal(verifyClearedDrillMetadataIndex < clickPreviewDetailIndex, true);
assert.equal(clickPreviewDetailIndex < verifyPreviewHostIntentIndex, true);
assert.equal(verifyPreviewHostIntentIndex < dismissPreviewIntentIndex, true);
assert.equal(dismissPreviewIntentIndex < clickStandaloneMarkIndex, true);
assert.equal(clickStandaloneMarkIndex < clickStandaloneDetailIndex, true);
assert.equal(clickStandaloneDetailIndex < verifyStandaloneHostIntentIndex, true);

console.log("report-builder-preview-import-provider-chart-date-save-reopen-scenario-assets ✓ imported saved payload reopens into provider-backed preview and standalone chart date-detail parity");
