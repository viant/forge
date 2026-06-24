import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-runtime-binding-metadata.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 1400,
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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Governed reporting model for the report builder preview.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Daily delivery grain")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Approved buying channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Certified available inventory")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[data-report-runtime-binding-panel=\"semantic\"]") && expression.includes("SELECTED MEASURES (1)") && expression.includes("CERTIFIED") && expression.includes("REVIEWED")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("runtime-binding-metadata")),
  true,
);

const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Trend Q3"));
const prepareGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare get request");
const requestHiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const inspectGetRequestIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get request");
const requestVisibleAfterInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const prepareSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const requestClearedAfterResponseIndex = scenario.steps.findIndex((step, index) => index > prepareSelectedResponseIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("!document.querySelector('[aria-label=\"Get ReportDocument request summary\"]')"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const bindingMetadataIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Governed reporting model for the report builder preview."));
const selectedMeasuresIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("SELECTED MEASURES (1)"));

assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(prepareGetRequestIndex, -1);
assert.notEqual(requestHiddenBeforeInspectIndex, -1);
assert.notEqual(inspectGetRequestIndex, -1);
assert.notEqual(requestVisibleAfterInspectIndex, -1);
assert.notEqual(prepareSelectedResponseIndex, -1);
assert.notEqual(requestClearedAfterResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(bindingMetadataIndex, -1);
assert.notEqual(selectedMeasuresIndex, -1);

assert.equal(selectedEntryIndex < prepareGetRequestIndex, true);
assert.equal(prepareGetRequestIndex < requestHiddenBeforeInspectIndex, true);
assert.equal(requestHiddenBeforeInspectIndex < inspectGetRequestIndex, true);
assert.equal(inspectGetRequestIndex < requestVisibleAfterInspectIndex, true);
assert.equal(requestVisibleAfterInspectIndex < prepareSelectedResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < requestClearedAfterResponseIndex, true);
assert.equal(prepareSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < bindingMetadataIndex, true);
assert.equal(bindingMetadataIndex < selectedMeasuresIndex, true);

console.log("report-builder-preview-reopen-report-document-runtime-binding-metadata-scenario-assets ✓ reopened report document exposes semantic binding metadata end-to-end");
