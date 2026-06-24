import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-blocks-save-reopen.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
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
  expressions.some((expression) => expression.includes("Prepare get response button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("markdownBlock")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Saved export request summary") && expression.includes("parsed?.kind === 'reportExportRequest'") && expression.includes("Reach KPI") && expression.includes("Inventory Note") && expression.includes("Author-provided inventory context.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"title\": \"Reach KPI\"") && expression.includes("\"title\": \"Inventory Note\"") && expression.includes("\"blockId\": \"kpiBlock\"") && expression.includes("\"blockId\": \"markdownBlock\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("offsetParent !== null") && expression.includes("querySelectorAll('section h3')") && expression.includes("titles[0] === 'Reach KPI'") && expression.includes("titles[1] === 'Inventory Note'") && expression.includes("bodyMatches >= 1")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reach KPI")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Inventory Note")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Reach KPI\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Inventory Note\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo.pdf'")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Report Builder Demo for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-blocks-save-reopen")),
  true,
);

const addNarrativeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inventory Note") && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const addKpiIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("kpiBlock") && String(step.expression || "").includes("Reach KPI"));
const moveUpIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("moveAuthoredDocumentBlock API not available."));
const reorderedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Reach KPI'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const inspectExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Inspect export button not found for saved report payload."));
const savedExportSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved export request summary") && String(step.expression || "").includes("Reach KPI") && String(step.expression || "").includes("Inventory Note"));
const submitExportIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Export snapshot button not found for saved report payload."));
const acceptedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Report Builder Demo."));
const firstRefreshIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Refresh status");
const queuedExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued."));
const secondRefreshIndex = findStepIndex((step, index) => index > firstRefreshIndex && step?.type === "clickRole" && step?.name === "Refresh status");
const succeededExportIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded."));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const downloadedArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo.pdf'"));
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"blockId\": \"kpiBlock\"") && String(step.expression || "").includes("\"blockId\": \"markdownBlock\""));
const removeNarrativeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("markdownBlock"));
const removedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles.length === 1") && String(step.expression || "").includes("Reach KPI"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getHydratedReportDocumentSession") && String(step.expression || "").includes("demoReportBuilder"));
const restoredOrderIndex = findStepIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Reach KPI'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const runtimeOrderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("offsetParent !== null") && String(step.expression || "").includes("querySelectorAll('section h3')") && String(step.expression || "").includes("titles[0] === 'Reach KPI'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));

assert.notEqual(addNarrativeIndex, -1);
assert.notEqual(addKpiIndex, -1);
assert.notEqual(moveUpIndex, -1);
assert.notEqual(reorderedIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(savedExportSummaryIndex, -1);
assert.notEqual(submitExportIndex, -1);
assert.notEqual(acceptedExportIndex, -1);
assert.notEqual(firstRefreshIndex, -1);
assert.notEqual(queuedExportIndex, -1);
assert.notEqual(secondRefreshIndex, -1);
assert.notEqual(succeededExportIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(downloadedArtifactIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeNarrativeIndex, -1);
assert.notEqual(removedStateIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedSessionIndex, -1);
assert.notEqual(restoredOrderIndex, -1);
assert.notEqual(runtimeOrderIndex, -1);

assert.equal(addNarrativeIndex < addKpiIndex, true);
assert.equal(addKpiIndex < moveUpIndex, true);
assert.equal(moveUpIndex < reorderedIndex, true);
assert.equal(reorderedIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < savedExportSummaryIndex, true);
assert.equal(savedExportSummaryIndex < submitExportIndex, true);
assert.equal(submitExportIndex < acceptedExportIndex, true);
assert.equal(acceptedExportIndex < firstRefreshIndex, true);
assert.equal(firstRefreshIndex < queuedExportIndex, true);
assert.equal(queuedExportIndex < secondRefreshIndex, true);
assert.equal(secondRefreshIndex < succeededExportIndex, true);
assert.equal(succeededExportIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < downloadedArtifactIndex, true);
assert.equal(downloadedArtifactIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetIndex, true);
assert.equal(hiddenGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeNarrativeIndex, true);
assert.equal(removeNarrativeIndex < removedStateIndex, true);
assert.equal(removedStateIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedSessionIndex, true);
assert.equal(reopenedSessionIndex < restoredOrderIndex, true);
assert.equal(restoredOrderIndex < runtimeOrderIndex, true);

console.log("report-builder-preview-authored-blocks-save-reopen-scenario-assets ✓ mixed authored KPI and narrative survive save/export/get/reopen ordering after post-save mutation");
