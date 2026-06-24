import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-document-metadata-downloads.scenario.mjs";

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
  expressions.some((expression) => expression.includes("__artifactDownloadCapture")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document title") && String(step.value || "") === "Executive Snapshot"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document subtitle") && String(step.value || "") === "Weekly Rollup"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Report document description") && String(step.value || "").includes("Authored payload metadata visibility.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update ReportDocument payload: Executive Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update conflict diagnostic: Executive Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Executive Snapshot-create-report-document.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Executive Snapshot-update-report-document-v7.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Executive Snapshot-update-conflict-v7-current-v9.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("createReportDocumentPayload") && expression.includes("Executive Snapshot") && expression.includes("Weekly Rollup") && expression.includes("Authored payload metadata visibility.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("updateReportDocumentPayload") && expression.includes("Executive Snapshot") && expression.includes("Weekly Rollup") && expression.includes("Authored payload metadata visibility.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("updateReportDocumentConflictDiagnostic") && expression.includes("\"reportId\": \"demoReportBuilder\"") && expression.includes("Executive Snapshot") && expression.includes("Weekly Rollup") && expression.includes("Authored payload metadata visibility.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("document-metadata-downloads")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare create payload");
const downloadCreateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download create payload");
const expectedVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Expected version") && String(step.value || "") === "7");
const prepareUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare update payload");
const downloadUpdateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download update payload");
const currentVersionIndex = findStepIndex((step) => step?.type === "fillSelector" && String(step.selector || "").includes("Current version") && String(step.value || "") === "9");
const prepareConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare conflict diagnostic");
const downloadConflictIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download conflict diagnostic");

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareCreateIndex, -1);
assert.notEqual(downloadCreateIndex, -1);
assert.notEqual(expectedVersionIndex, -1);
assert.notEqual(prepareUpdateIndex, -1);
assert.notEqual(downloadUpdateIndex, -1);
assert.notEqual(currentVersionIndex, -1);
assert.notEqual(prepareConflictIndex, -1);
assert.notEqual(downloadConflictIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareCreateIndex, true);
assert.equal(prepareCreateIndex < downloadCreateIndex, true);
assert.equal(downloadCreateIndex < expectedVersionIndex, true);
assert.equal(expectedVersionIndex < prepareUpdateIndex, true);
assert.equal(prepareUpdateIndex < downloadUpdateIndex, true);
assert.equal(downloadUpdateIndex < currentVersionIndex, true);
assert.equal(currentVersionIndex < prepareConflictIndex, true);
assert.equal(prepareConflictIndex < downloadConflictIndex, true);

console.log("report-builder-preview-document-metadata-downloads-scenario-assets ✓ document metadata downloads stay ordered and emit create/update/conflict files with metadata")
