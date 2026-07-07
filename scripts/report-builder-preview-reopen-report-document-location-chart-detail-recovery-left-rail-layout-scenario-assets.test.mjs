import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-detail-recovery-left-rail-layout.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceDetailTargetBehaviors API not available.") && expression.includes("detailTarget: null")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('text.includes("Dimensions Market")') && expression.includes('text.includes("Measures Available Impressions")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_LOCATION_CHART_RECOVERY_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("ariaWidth === 20") && expression.includes("runtimeText.includes(\"Show market details\")") && expression.includes("runtimeText.includes(\"US\")")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Runtime Diagnostics") && expression.includes('text.includes("target://example/performance/market-detail")') && expression.includes('text.includes("US")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('text.includes("target://example/performance/market-detail")') && expression.includes('text.includes("CA")')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-detail-recovery-left-rail-layout")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Selected value:") && String(step?.expression || "").includes("US") && String(step?.expression || "").includes("Show market details"));
const semanticBindingIndex = scenario.steps.findIndex((step, index) => index > selectedValueIndex
  && step?.type === "waitForDomContains"
  && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const runtimeSemanticIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('text.includes("Dimensions Market")'));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("ariaWidth === 20") && String(step?.expression || "").includes("runtimeText.includes(\"Show market details\")"));
const firstDetailActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show market details" && step?.index === 0);
const runtimeDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Runtime Diagnostics"));
const clearBehaviorsIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearDetailTargetBehaviors API not available."));
const recoveryClickIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-chart-action" && step?.text === "Show market details" && step?.index === 0 && scenario.steps.indexOf(step) > clearBehaviorsIndex);
const recoveryResolvedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('text.includes("target://example/performance/market-detail")') && String(step?.expression || "").includes('text.includes("CA")'));

assert.notEqual(reopenIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(runtimeSemanticIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailSettledIndex, -1);
assert.notEqual(firstDetailActionIndex, -1);
assert.notEqual(runtimeDiagnosticsIndex, -1);
assert.notEqual(clearBehaviorsIndex, -1);
assert.notEqual(recoveryClickIndex, -1);
assert.notEqual(recoveryResolvedIndex, -1);

assert.equal(reopenIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < runtimeSemanticIndex, true);
assert.equal(runtimeSemanticIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailSettledIndex, true);
assert.equal(narrowRailSettledIndex < firstDetailActionIndex, true);
assert.equal(firstDetailActionIndex < runtimeDiagnosticsIndex, true);
assert.equal(runtimeDiagnosticsIndex < clearBehaviorsIndex, true);
assert.equal(clearBehaviorsIndex < recoveryClickIndex, true);
assert.equal(recoveryClickIndex < recoveryResolvedIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-detail-recovery-left-rail-layout-scenario-assets ✓ reopened location chart detail recovery keeps runtime semantic binding and location detail actions visible after narrowing the setup rail");
