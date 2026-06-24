import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-saved-report-payload.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.filename === 'Report Builder Demo-saved-report-payload.json'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("window.__artifactDownloadCapture.payload.includes('\"kind\": \"reportBuilder.savedReportPayload\"')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.querySelector('[aria-label=\"Saved report payload summary\"]')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Download report payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect report payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide report payload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("reportBuilder.savedReportPayload")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"payloadId\": \"rbreport_")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportDocument\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportSpec\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("saved-report-payload")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save report file"),
  false,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved report payload summary\"]')"));
const downloadPayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Download report payload");
const payloadDownloadedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Report Builder Demo-saved-report-payload.json"));
const inspectPayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect report payload");
const payloadVisibleIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!!document.querySelector('[aria-label=\"Saved report payload summary\"]')"));
const hidePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide report payload");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hidePayloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved report payload summary\"]')"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(downloadPayloadIndex, -1);
assert.notEqual(payloadDownloadedIndex, -1);
assert.notEqual(inspectPayloadIndex, -1);
assert.notEqual(payloadVisibleIndex, -1);
assert.notEqual(hidePayloadIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < downloadPayloadIndex, true);
assert.equal(downloadPayloadIndex < payloadDownloadedIndex, true);
assert.equal(payloadDownloadedIndex < inspectPayloadIndex, true);
assert.equal(inspectPayloadIndex < payloadVisibleIndex, true);
assert.equal(payloadVisibleIndex < hidePayloadIndex, true);
assert.equal(hidePayloadIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-saved-report-payload-scenario-assets ✓ saved report payload follows the current inspector/download contract and preserves hidden state before and after inspection");
