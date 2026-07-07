import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-chart-detail-response-left-rail-layout.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_CHART_DETAIL_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("drillPanel.scrollWidth <= drillPanel.clientWidth + 1") && expression.includes("Show channel details") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("runtimeText.includes(\"Show channel details\")")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("chart-detail-response-left-rail-layout")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const runtimeChartReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("chartSpec?.title === 'Avails by Date and Channel'"));
const semanticBindingIndex = scenario.steps.findIndex((step, index) => index > runtimeChartReadyIndex
  && step?.type === "waitForDomContains"
  && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const runtimeSemanticIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("ariaWidth === 20") && String(step?.expression || "").includes("runtimeText.includes(\"Show channel details\")"));
const legendClickIndex = findStepIndex((step) => step?.type === "clickSelector" && step?.selector === ".forge-report-runtime-chart-panel .forge-chart-legend-action");
const detailActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-chart-action" && step?.text === "Show channel details");
const resolvedTargetRefIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step?.text || "").includes("target://example/performance/channel-detail"));
const resolvedHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("text.includes('channel')") && String(step?.expression || "").includes("text.includes('Display')"));

assert.notEqual(reopenIndex, -1);
assert.notEqual(runtimeChartReadyIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(runtimeSemanticIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailSettledIndex, -1);
assert.notEqual(legendClickIndex, -1);
assert.notEqual(detailActionIndex, -1);
assert.notEqual(resolvedTargetRefIndex, -1);
assert.notEqual(resolvedHostIntentIndex, -1);

assert.equal(reopenIndex < runtimeChartReadyIndex, true);
assert.equal(runtimeChartReadyIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < runtimeSemanticIndex, true);
assert.equal(runtimeSemanticIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailSettledIndex, true);
assert.equal(narrowRailSettledIndex < legendClickIndex, true);
assert.equal(legendClickIndex < detailActionIndex, true);
assert.equal(detailActionIndex < resolvedTargetRefIndex, true);
assert.equal(resolvedTargetRefIndex < resolvedHostIntentIndex, true);

console.log("report-builder-preview-reopen-report-document-chart-detail-response-left-rail-layout-scenario-assets ✓ reopened chart detail response keeps runtime semantic binding and chart detail actions visible after narrowing the setup rail");
