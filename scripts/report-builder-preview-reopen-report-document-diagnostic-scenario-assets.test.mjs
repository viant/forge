import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-diagnostic.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopen diagnostic: Capacity Archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Historical Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("reportBuilder.reopenDiagnostic")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"code\": \"incompatibleSource\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"responseKind\": \"listReportDocumentsResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"builderTarget\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"documentVersion\": 7")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"state\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"config\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopen-report-document-diagnostic")),
  true,
);

const selectedArchiveIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Capacity Archive"));
const checkCompatibilityIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Check reopen compatibility");
const diagnosticHiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("reportBuilder.reopenDiagnostic"));
const inspectDiagnosticIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect reopen diagnostic");
const diagnosticVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("reportBuilder.reopenDiagnostic"));
const codeVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("\"code\": \"incompatibleSource\""));
const hideDiagnosticIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide reopen diagnostic");
const codeHiddenIndex = scenario.steps.findIndex((step, index) => index > hideDiagnosticIndex && step?.type === "assertDomNotContains" && String(step?.text || "").includes("\"code\": \"incompatibleSource\""));

assert.notEqual(selectedArchiveIndex, -1);
assert.notEqual(checkCompatibilityIndex, -1);
assert.notEqual(diagnosticHiddenBeforeInspectIndex, -1);
assert.notEqual(inspectDiagnosticIndex, -1);
assert.notEqual(diagnosticVisibleIndex, -1);
assert.notEqual(codeVisibleIndex, -1);
assert.notEqual(hideDiagnosticIndex, -1);
assert.notEqual(codeHiddenIndex, -1);

assert.equal(selectedArchiveIndex < checkCompatibilityIndex, true);
assert.equal(checkCompatibilityIndex < diagnosticHiddenBeforeInspectIndex, true);
assert.equal(diagnosticHiddenBeforeInspectIndex < inspectDiagnosticIndex, true);
assert.equal(inspectDiagnosticIndex < diagnosticVisibleIndex, true);
assert.equal(diagnosticVisibleIndex < codeVisibleIndex, true);
assert.equal(codeVisibleIndex < hideDiagnosticIndex, true);
assert.equal(hideDiagnosticIndex < codeHiddenIndex, true);

console.log("report-builder-preview-reopen-report-document-diagnostic-scenario-assets ✓ reopen diagnostic stays structured, excludes reopenable state/config payloads, and hides cleanly");
