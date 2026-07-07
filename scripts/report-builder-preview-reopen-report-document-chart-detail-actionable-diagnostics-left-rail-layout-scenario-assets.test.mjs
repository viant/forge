import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-actionable-diagnostics-left-rail-layout.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchSeededSavedReportPayload") && expression.includes("capacityTrendQ3") && expression.includes("documentBlockChartInvalid")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("ariaWidth === 20") && expression.includes("runtimeText.includes(\"Show channel details\")") && expression.includes("Reopened compile diagnostics") && expression.includes("Primary Chart is no longer compatible with the current builder selection.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("ariaWidth === 20") && expression.includes("!bodyText.includes(\"Reopened compile diagnostics\")") && expression.includes("!bodyText.includes(\"Runtime Diagnostics\")") && expression.includes("Dimensions Delivery Date, Channel")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-actionable-diagnostics-left-rail-layout")),
  true,
);

const reopenedDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailInvalidIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("runtimeText.includes(\"Show channel details\")") && String(step?.expression || "").includes("Primary Chart is no longer compatible with the current builder selection."));
const failureActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show channel details" && step?.index === 0);
const patchCleanCompileStateIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("reopenedCompileState") && String(step?.expression || "").includes("\"status\":\"clean\""));
const diagnosticsHiddenIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const runtimeDiagnosticsHiddenIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const narrowRailCleanIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!bodyText.includes(\"Reopened compile diagnostics\")") && String(step?.expression || "").includes("!bodyText.includes(\"Runtime Diagnostics\")"));

assert.notEqual(reopenedDiagnosticsIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailInvalidIndex, -1);
assert.notEqual(failureActionIndex, -1);
assert.notEqual(patchCleanCompileStateIndex, -1);
assert.notEqual(diagnosticsHiddenIndex, -1);
assert.notEqual(runtimeDiagnosticsHiddenIndex, -1);
assert.notEqual(narrowRailCleanIndex, -1);

assert.equal(reopenedDiagnosticsIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailInvalidIndex, true);
assert.equal(narrowRailInvalidIndex < failureActionIndex, true);
assert.equal(failureActionIndex < patchCleanCompileStateIndex, true);
assert.equal(patchCleanCompileStateIndex < diagnosticsHiddenIndex, true);
assert.equal(diagnosticsHiddenIndex < runtimeDiagnosticsHiddenIndex, true);
assert.equal(runtimeDiagnosticsHiddenIndex < narrowRailCleanIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-actionable-diagnostics-left-rail-layout-scenario-assets ✓ reopened chart actionable diagnostics keep runtime semantic metadata visible under a narrowed setup rail before and after diagnostics clear");
