import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-blocks-export-submit-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 18);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Inventory Note") && expression.includes("Author-provided inventory context.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("kpiBlock") && expression.includes("Reach KPI")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("moveAuthoredDocumentBlock API not available.") && expression.includes("kpiBlock")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Report Builder Demo.") && expression.includes("demo-export-job-submit-failed-blocks")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Report Builder Demo.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Reach KPI") && expression.includes("Inventory Note") && expression.includes("demo-export-job-submit-failed-blocks") && expression.includes("!text.includes('demo-export-job-1')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export: Report Builder Demo")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-blocks-export-submit-failure")),
  true,
);

const addNarrativeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inventory Note") && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const addKpiIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("kpiBlock") && String(step.expression || "").includes("Reach KPI"));
const moveUpIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("moveAuthoredDocumentBlock API not available."));
const reorderedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Reach KPI'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Preview export submit was rejected for Report Builder Demo."));
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found for saved report payload."));
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Report Builder Demo."));
const failedJobIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("demo-export-job-submit-failed-blocks") && String(step.expression || "").includes("!text.includes('demo-export-job-1')"));
const failedSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export: Report Builder Demo"));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(addNarrativeIndex, -1);
assert.notEqual(addKpiIndex, -1);
assert.notEqual(moveUpIndex, -1);
assert.notEqual(reorderedIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(failedJobIndex, -1);
assert.notEqual(failedSummaryIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(addNarrativeIndex < addKpiIndex, true);
assert.equal(addKpiIndex < moveUpIndex, true);
assert.equal(moveUpIndex < reorderedIndex, true);
assert.equal(reorderedIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < submitExportIndex, true);
assert.equal(submitExportIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < failedJobIndex, true);
assert.equal(failedJobIndex < failedSummaryIndex, true);
assert.equal(failedSummaryIndex < noDownloadIndex, true);

console.log("report-builder-preview-authored-blocks-export-submit-failure-scenario-assets ✓ multi-block semantic saved-payload export submit failures stay explicit while semantic context remains visible");
