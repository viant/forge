import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-blocks-export-artifact-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 22);

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Report Builder Demo.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Report Builder Demo.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("demo-export-artifact-1") && expression.includes("succeeded") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Reach KPI") && expression.includes("Inventory Note")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === ''") && expression.includes("payloadReady === false")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-blocks-export-artifact-failure")),
  true,
);

const addNarrativeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inventory Note") && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const addKpiIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("kpiBlock") && String(step.expression || "").includes("Reach KPI"));
const moveUpIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("moveAuthoredDocumentBlock API not available."));
const reorderedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Reach KPI'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found for saved report payload."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const queuedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const secondRefreshIndex = findStepIndex((step, index) => index > firstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const succeededIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceExportBehaviors") && String(step.expression || "").includes("Could not load the preview export artifact for Report Builder Demo."));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const failureVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Report Builder Demo."));
const noDownloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''"));

assert.notEqual(addNarrativeIndex, -1);
assert.notEqual(addKpiIndex, -1);
assert.notEqual(moveUpIndex, -1);
assert.notEqual(reorderedIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(queuedIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(succeededIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(failureVisibleIndex, -1);
assert.notEqual(noDownloadIndex, -1);

assert.equal(addNarrativeIndex < addKpiIndex, true);
assert.equal(addKpiIndex < moveUpIndex, true);
assert.equal(moveUpIndex < reorderedIndex, true);
assert.equal(reorderedIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < queuedIndex, true);
assert.equal(queuedIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < succeededIndex, true);
assert.equal(succeededIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < failureVisibleIndex, true);
assert.equal(failureVisibleIndex < noDownloadIndex, true);

console.log("report-builder-preview-authored-blocks-export-artifact-failure-scenario-assets ✓ multi-block semantic saved-payload export artifact failures stay explicit while semantic context remains visible");
