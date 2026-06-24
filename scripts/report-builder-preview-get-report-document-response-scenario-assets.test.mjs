import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-get-report-document-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo-getReportDocumentResponse.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"getReportDocumentResponse\"')") && expression.includes("\"documentVersion\": 11") && expression.includes("\"modelLabel\": \"Ad Delivery\"") && expression.includes("\"entityLabel\": \"Line Delivery\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("getReportDocumentResponse")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"semanticSummary\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"modelLabel\": \"Ad Delivery\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"entityLabel\": \"Line Delivery\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"compileState\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("get-report-document-response")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get response");
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));
const downloadResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download get response");
const downloadedResponseIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Report Builder Demo-getReportDocumentResponse.json"));
const inspectResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const responseVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));
const hideResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide get response");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideResponseIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument response summary\"]')"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetResponseIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(downloadResponseIndex, -1);
assert.notEqual(downloadedResponseIndex, -1);
assert.notEqual(inspectResponseIndex, -1);
assert.notEqual(responseVisibleIndex, -1);
assert.notEqual(hideResponseIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetResponseIndex, true);
assert.equal(prepareGetResponseIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < downloadResponseIndex, true);
assert.equal(downloadResponseIndex < downloadedResponseIndex, true);
assert.equal(downloadedResponseIndex < inspectResponseIndex, true);
assert.equal(inspectResponseIndex < responseVisibleIndex, true);
assert.equal(responseVisibleIndex < hideResponseIndex, true);
assert.equal(hideResponseIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-get-report-document-response-scenario-assets ✓ get response follows the current hidden-inspect-download contract and preserves semantic response details");
