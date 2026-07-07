import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-actionable-diagnostics.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchSeededSavedReportPayload") && expression.includes("capacityTrendQ3") && expression.includes("documentBlockChartInvalid")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("target://example/performance/channel-detail")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("patchBuilderState") && expression.includes("reopenedCompileState") && expression.includes("\"status\":\"clean\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearDetailTargetBehaviors API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('Failed to resolve detail target target://example/performance/channel-detail. Detail target resolution failed.')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("target://example/performance/channel-detail")') && expression.includes('text.includes("CTV")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('.forge-report-builder__runtime-preview .forge-report-runtime-host-intent') && expression.includes('text.includes("target://example/performance/channel-detail")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened compile diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Primary Chart is no longer compatible with the current builder selection.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('data-report-builder-scope-summary="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")') && expression.includes('text.includes("Filters")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Reopened compile diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-actionable-diagnostics")),
  true,
);

const patchCompileStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchSeededSavedReportPayload"));
const prepareSelectedGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const injectBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceDetailTargetBehaviors API not available."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const runtimeSemanticVisibleWhileInvalidIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));
const failureActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show channel details");
const clearBehaviorIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("target://example/performance/channel-detail")') && String(step?.expression || "").includes('text.includes("CTV")'));
const patchCleanCompileStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("reopenedCompileState") && String(step?.expression || "").includes("\"status\":\"clean\""));
const cleanCompileStateIndex = findStepIndex((step) => step?.type === "waitForEval" && (String(step?.expression || "").includes("reopenedCompileState?.status === 'clean'") || String(step?.expression || "").includes('reopenedCompileState?.status === \"clean\"')));
const diagnosticsHiddenIndex = scenario.steps.findIndex((step, index) => index > cleanCompileStateIndex && step?.type === "assertDomNotContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const runtimeDiagnosticsHiddenIndex = scenario.steps.findIndex((step, index) => index > cleanCompileStateIndex && step?.type === "assertDomNotContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const runtimeSemanticVisibleAfterCleanIndex = scenario.steps.findIndex((step, index) => index > cleanCompileStateIndex && step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));

assert.notEqual(patchCompileStateIndex, -1);
assert.notEqual(prepareSelectedGetIndex, -1);
assert.notEqual(injectBehaviorIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedDiagnosticsIndex, -1);
assert.notEqual(runtimeSemanticVisibleWhileInvalidIndex, -1);
assert.notEqual(failureActionIndex, -1);
assert.notEqual(clearBehaviorIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);
assert.notEqual(patchCleanCompileStateIndex, -1);
assert.notEqual(cleanCompileStateIndex, -1);
assert.notEqual(diagnosticsHiddenIndex, -1);
assert.notEqual(runtimeDiagnosticsHiddenIndex, -1);
assert.notEqual(runtimeSemanticVisibleAfterCleanIndex, -1);

assert.equal(patchCompileStateIndex < prepareSelectedGetIndex, true);
assert.equal(prepareSelectedGetIndex < injectBehaviorIndex, true);
assert.equal(injectBehaviorIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedDiagnosticsIndex, true);
assert.equal(reopenedDiagnosticsIndex < runtimeSemanticVisibleWhileInvalidIndex, true);
assert.equal(runtimeSemanticVisibleWhileInvalidIndex < failureActionIndex, true);
assert.equal(failureActionIndex < clearBehaviorIndex, true);
assert.equal(clearBehaviorIndex < recoveryResolvedIndex, true);
assert.equal(recoveryResolvedIndex < patchCleanCompileStateIndex, true);
assert.equal(patchCleanCompileStateIndex < cleanCompileStateIndex, true);
assert.equal(cleanCompileStateIndex < diagnosticsHiddenIndex, true);
assert.equal(diagnosticsHiddenIndex < runtimeDiagnosticsHiddenIndex, true);
assert.equal(runtimeDiagnosticsHiddenIndex < runtimeSemanticVisibleAfterCleanIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-actionable-diagnostics-scenario-assets ✓ reopened chart runtime diagnostics can clear while authored runtime semantic sections remain visible");
