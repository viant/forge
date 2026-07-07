import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-empty-table-apply-current-fields.scenario.mjs";

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
  expressions.some((expression) => expression.includes("reportBuilder.workspaceMode.desktop.demoReportBuilder.demoReportBuilderWindow") && expression.includes("\"design\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("\"detailTable\"") && expression.includes("\"columns\":[]")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Detail Table does not define any table fields.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Apply current fields"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Detail Table now uses the current fields. Refreshing results.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Report mode. Run the report and review the live result."),
  true,
);
assert.equal(
  scenario.steps.filter((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")).length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("May 1, 2026") && expression.includes("Display") && expression.includes("Available Impressions") && expression.includes("does not define any table fields")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("empty-table-apply-current-fields-proof")),
  true,
);

const setDesignModeIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("reportBuilder.workspaceMode.desktop.demoReportBuilder.demoReportBuilderWindow"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > setDesignModeIndex && step?.type === "reload");
const patchStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderState") && String(step?.expression || "").includes("\"detailTable\""));
const emptyDiagnosticIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Detail Table does not define any table fields."));
const clickApplyIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply current fields");
const refreshedFeedbackIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Detail Table now uses the current fields. Refreshing results."));
const clickReportIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Report mode. Run the report and review the live result.");
const reportSemanticIndex = findStepIndex((step, index) => index > clickReportIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const reportVerifiedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("May 1, 2026") && String(step?.expression || "").includes("Available Impressions"));

assert.notEqual(setDesignModeIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(patchStateIndex, -1);
assert.notEqual(emptyDiagnosticIndex, -1);
assert.notEqual(clickApplyIndex, -1);
assert.notEqual(refreshedFeedbackIndex, -1);
assert.notEqual(clickReportIndex, -1);
assert.notEqual(reportSemanticIndex, -1);
assert.notEqual(reportVerifiedIndex, -1);

assert.equal(setDesignModeIndex < reloadIndex, true);
assert.equal(reloadIndex < patchStateIndex, true);
assert.equal(patchStateIndex < emptyDiagnosticIndex, true);
assert.equal(emptyDiagnosticIndex < clickApplyIndex, true);
assert.equal(clickApplyIndex < refreshedFeedbackIndex, true);
assert.equal(refreshedFeedbackIndex < clickReportIndex, true);
assert.equal(clickReportIndex < reportSemanticIndex, true);
assert.equal(reportSemanticIndex < reportVerifiedIndex, true);

console.log("report-builder-preview-empty-table-apply-current-fields-scenario-assets ✓ repairs an empty authored table through the real design action and verifies report content");
