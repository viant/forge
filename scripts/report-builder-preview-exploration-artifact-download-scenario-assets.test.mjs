import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-artifact-download.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 10);

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
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save artifact"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download artifact"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo-exploration-artifact.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.mimeType.includes('application/json')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payloadReady === true")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportBuilder.explorationArtifact\"')") && expression.includes("window.__artifactDownloadCapture.payload.includes('\"artifactId\": \"rbexploration_')") && expression.includes("window.__artifactDownloadCapture.payload.includes('\"reportSpec\": {')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-artifact-download")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const savedArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo"));
const downloadArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download artifact");
const filenameIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Report Builder Demo-exploration-artifact.json"));
const mimeTypeIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("mimeType.includes('application/json')"));
const payloadReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("payloadReady === true"));
const payloadContentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportBuilder.explorationArtifact\"')"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(savedArtifactIndex, -1);
assert.notEqual(downloadArtifactIndex, -1);
assert.notEqual(filenameIndex, -1);
assert.notEqual(mimeTypeIndex, -1);
assert.notEqual(payloadReadyIndex, -1);
assert.notEqual(payloadContentIndex, -1);

assert.equal(saveArtifactIndex < savedArtifactIndex, true);
assert.equal(savedArtifactIndex < downloadArtifactIndex, true);
assert.equal(downloadArtifactIndex < filenameIndex, true);
assert.equal(filenameIndex < mimeTypeIndex, true);
assert.equal(mimeTypeIndex < payloadReadyIndex, true);
assert.equal(payloadReadyIndex < payloadContentIndex, true);

console.log("report-builder-preview-exploration-artifact-download-scenario-assets ✓ saved exploration artifact download emits the expected filename and JSON payload contract");
