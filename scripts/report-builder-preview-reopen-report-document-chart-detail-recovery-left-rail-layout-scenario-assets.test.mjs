import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-recovery-left-rail-layout.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors") && expression.includes("detailTarget: null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_CHART_RECOVERY_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("runtimeText.includes(\"Show channel details\")") && expression.includes("runtimeText.includes(\"Display\")")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-recovery-left-rail-layout")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected value:") && String(step?.expression || "").includes("Display"));
const semanticBindingIndex = scenario.steps.findIndex((step, index) => index > selectedValueIndex
  && step?.type === "waitForDomContains"
  && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const runtimeSemanticIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("ariaWidth === 20") && String(step?.expression || "").includes("runtimeText.includes(\"Show channel details\")"));
const firstDetailActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details" && step?.index === 0);
const omittedDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Detail target resolved with omitted parameters:"));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors"));
const secondDetailActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show channel details" && step?.index === 0);
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes(\"target://example/performance/channel-detail\")") && String(step?.expression || "").includes("text.includes(\"CTV\")"));

assert.notEqual(reopenIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(runtimeSemanticIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailSettledIndex, -1);
assert.notEqual(firstDetailActionIndex, -1);
assert.notEqual(omittedDiagnosticsIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(secondDetailActionIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(reopenIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < runtimeSemanticIndex, true);
assert.equal(runtimeSemanticIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailSettledIndex, true);
assert.equal(narrowRailSettledIndex < firstDetailActionIndex, true);
assert.equal(firstDetailActionIndex < omittedDiagnosticsIndex, true);
assert.equal(omittedDiagnosticsIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < secondDetailActionIndex, true);
assert.equal(secondDetailActionIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-recovery-left-rail-layout-scenario-assets ✓ reopened chart detail recovery keeps runtime semantic binding and chart recovery actions visible after narrowing the setup rail");
