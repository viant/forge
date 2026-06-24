import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-actionable-diagnostics.scenario.mjs";

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

function findLastStepIndex(predicate) {
  return scenario.steps
    .map((step, index) => (predicate(step) ? index : -1))
    .filter((index) => index >= 0)
    .pop() ?? -1;
}

assert.equal(
  expressions.some((expression) => expression.includes("patchSeededSavedReportPayload") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentBlockChartInvalid")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Template: Capacity Location Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened compile diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Primary Chart is no longer compatible with the current builder selection.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-actionable-diagnostics")),
  true,
);

const patchCompileStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchSeededSavedReportPayload"));
const prepareSelectedGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const reloadIndex = findLastStepIndex((step) => step?.type === "reload");
const reloadedInvalidIndex = findStepIndex((step) => step?.type === "waitForEval" && (String(step?.expression || "").includes("reopenedCompileState?.status === 'invalid'") || String(step?.expression || "").includes('reopenedCompileState?.status === "invalid"')) && scenario.steps.indexOf(step) > reloadIndex);

assert.notEqual(patchCompileStateIndex, -1);
assert.notEqual(prepareSelectedGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedDiagnosticsIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(reloadedInvalidIndex, -1);

assert.equal(patchCompileStateIndex < prepareSelectedGetIndex, true);
assert.equal(prepareSelectedGetIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedDiagnosticsIndex, true);
assert.equal(reopenedDiagnosticsIndex < reloadIndex, true);
assert.equal(reloadIndex < reloadedInvalidIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-actionable-diagnostics-scenario-assets ✓ reopened location chart diagnostics persist across reload");
