import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-template-saved-payload-export-status-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Market Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("Executive Summary") && expression.includes("Headline KPI") && expression.includes("\"reportDocumentTemplateId\": \"market_brief\"") && expression.includes("\"reportDocumentTemplateLabel\": \"Market Brief\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for Market Brief.") && expression.includes("error: 'Renderer rejected reportPrint for Market Brief.'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Market Brief.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-job-1") && expression.includes("failed") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Executive Summary") && expression.includes("Headline KPI")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("template-saved-payload-export-status-failure")),
  true,
);

const applyTemplateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply template");
const selectTemplateIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".bp6-menu-item" && step?.text === "Market Brief");
const forkIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Fork from here");
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inspect export button not found for Market Brief payload."));
const exportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary") && String(step.expression || "").includes("Executive Summary") && String(step.expression || "").includes("Headline KPI"));
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found for Market Brief payload."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Market Brief."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Renderer rejected reportPrint for Market Brief."));
const refreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for Market Brief."));
const diagnosticIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer."));

assert.notEqual(applyTemplateIndex, -1);
assert.notEqual(selectTemplateIndex, -1);
assert.notEqual(forkIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(exportSummaryIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(refreshIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(diagnosticIndex, -1);

assert.equal(applyTemplateIndex < selectTemplateIndex, true);
assert.equal(selectTemplateIndex < forkIndex, true);
assert.equal(forkIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < exportSummaryIndex, true);
assert.equal(exportSummaryIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < refreshIndex, true);
assert.equal(refreshIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < diagnosticIndex, true);

console.log("report-builder-preview-semantic-template-saved-payload-export-status-failure-scenario-assets ✓ Market Brief saved-payload export status failures stay explicit while template and semantic context remain visible");
