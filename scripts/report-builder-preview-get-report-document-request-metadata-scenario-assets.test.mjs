import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-get-report-document-request-metadata.scenario.mjs";

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
  expressions.some((expression) => expression.includes("Saved report payload: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Get ReportDocument request: Executive Snapshot") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Executive Snapshot-get-report-document-request.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentRequest\"')") && expression.includes("window.__artifactDownloadCapture.payload.includes('\"reportId\": \"demoReportBuilder\"')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Show API artifacts"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download get request"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Weekly Rollup")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get request metadata visibility.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"demoReportBuilder\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("get-report-document-request-metadata")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save report file"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const savedPayloadMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Saved report payload: Executive Snapshot") && String(step.expression || "").includes("Semantic Binding"));
const showApiArtifactsIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Show API artifacts");
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const requestMetadataIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Get ReportDocument request: Executive Snapshot") && String(step.expression || "").includes("Semantic Binding"));
const requestHiddenIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const inspectRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const downloadRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download get request");
const downloadedRequestIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Executive Snapshot-get-report-document-request.json"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(savedPayloadMetadataIndex, -1);
assert.notEqual(showApiArtifactsIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(requestMetadataIndex, -1);
assert.notEqual(requestHiddenIndex, -1);
assert.notEqual(inspectRequestIndex, -1);
assert.notEqual(downloadRequestIndex, -1);
assert.notEqual(downloadedRequestIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < savedPayloadMetadataIndex, true);
assert.equal(savedPayloadMetadataIndex < showApiArtifactsIndex, true);
assert.equal(showApiArtifactsIndex < prepareListIndex, true);
assert.equal(prepareListIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < requestMetadataIndex, true);
assert.equal(requestMetadataIndex < requestHiddenIndex, true);
assert.equal(requestHiddenIndex < inspectRequestIndex, true);
assert.equal(inspectRequestIndex < downloadRequestIndex, true);
assert.equal(downloadRequestIndex < downloadedRequestIndex, true);

console.log("report-builder-preview-get-report-document-request-metadata-scenario-assets ✓ get request metadata survives the current saved payload API-artifact flow and exports the correct request payload");
