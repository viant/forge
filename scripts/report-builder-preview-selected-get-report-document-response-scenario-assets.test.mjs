import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-get-report-document-response.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 40);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Only entries backed by a local ReportDocument payload can be expanded locally.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 4")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect list response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-get-report-document-response")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Get ReportDocument request summary")),
  true,
);

const selectedArchiveIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Archive"));
const inspectListResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect list response");
const archivePrepareResponseIndexes = findStepIndexes((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const prepareSelectedArchiveBeforeRequestIndex = archivePrepareResponseIndexes[0] ?? -1;
const prepareSelectedArchiveAfterRequestIndex = archivePrepareResponseIndexes[1] ?? -1;
const unsupportedMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Only entries backed by a local ReportDocument payload can be expanded locally."));
const selectedCapacityIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Q3"));
const capacityResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Capacity Q3"));
const hideResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide get response");
const selectedDemoIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Report Builder Demo"));
const demoResponseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Report Builder Demo"));

assert.notEqual(selectedArchiveIndex, -1);
assert.notEqual(inspectListResponseIndex, -1);
assert.equal(archivePrepareResponseIndexes.length >= 4, true);
assert.notEqual(prepareSelectedArchiveBeforeRequestIndex, -1);
assert.notEqual(prepareSelectedArchiveAfterRequestIndex, -1);
assert.notEqual(unsupportedMessageIndex, -1);
assert.notEqual(selectedCapacityIndex, -1);
assert.notEqual(capacityResponseIndex, -1);
assert.notEqual(hideResponseIndex, -1);
assert.notEqual(selectedDemoIndex, -1);
assert.notEqual(demoResponseIndex, -1);

assert.equal(selectedArchiveIndex < inspectListResponseIndex, true);
assert.equal(inspectListResponseIndex < prepareSelectedArchiveBeforeRequestIndex, true);
assert.equal(prepareSelectedArchiveBeforeRequestIndex < prepareSelectedArchiveAfterRequestIndex, true);
assert.equal(prepareSelectedArchiveAfterRequestIndex < unsupportedMessageIndex, true);
assert.equal(unsupportedMessageIndex < selectedCapacityIndex, true);
assert.equal(selectedCapacityIndex < capacityResponseIndex, true);
assert.equal(capacityResponseIndex < hideResponseIndex, true);
assert.equal(hideResponseIndex < selectedDemoIndex, true);
assert.equal(selectedDemoIndex < demoResponseIndex, true);

console.log("report-builder-preview-selected-get-report-document-response-scenario-assets ✓ selected get response covers unsupported local expansion and supported capacity/demo responses");
