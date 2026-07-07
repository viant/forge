import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-detail-target-provider-preset-save-reopen-left-rail-layout.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label=\\"Authored runtime preview\\"]') && expression.includes('data-report-builder-semantic-binding="true"') && expression.includes('text.includes("Dimensions Delivery Date, Channel")') && expression.includes('text.includes("Measures Available Impressions")')),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_REOPENED_DRILL_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("railWidth <= before - 24") && expression.includes("ariaWidth === 20") && expression.includes("drillPanel.scrollWidth <= drillPanel.clientWidth + 1") && expression.includes("insideBounds") && expression.includes("Show channel details") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("runtimeText.includes(\"Show Channel details\")")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("provider-preset-save-reopen-left-rail-layout")),
  true,
);

const hydratedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("getHydratedReportDocumentSession") && String(step?.expression || "").includes("documentVersion === 31"));
const semanticBindingIndex = scenario.steps.findIndex((step, index) => index > hydratedSessionIndex
  && step?.type === "waitForDomContains"
  && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));
const runtimeSemanticIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('data-report-builder-semantic-binding="true"') && String(step?.expression || "").includes('text.includes("Dimensions Delivery Date, Channel")'));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailSettledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("railWidth <= before - 24") && String(step?.expression || "").includes("insideBounds"));
const runtimeActionIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Show Channel details");
const resolvedHostIntentIndex = findStepIndex((step) => step?.type === "waitForEval"
  && String(step?.expression || "").includes(".forge-report-builder__runtime-preview .forge-report-runtime-host-intent")
  && String(step?.expression || "").includes("text.includes('Prospect Sprint')"));

assert.notEqual(hydratedSessionIndex, -1);
assert.notEqual(semanticBindingIndex, -1);
assert.notEqual(runtimeSemanticIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailSettledIndex, -1);
assert.notEqual(runtimeActionIndex, -1);
assert.notEqual(resolvedHostIntentIndex, -1);

assert.equal(hydratedSessionIndex < semanticBindingIndex, true);
assert.equal(semanticBindingIndex < runtimeSemanticIndex, true);
assert.equal(runtimeSemanticIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailSettledIndex, true);
assert.equal(narrowRailSettledIndex < runtimeActionIndex, true);
assert.equal(runtimeActionIndex < resolvedHostIntentIndex, true);

console.log("report-builder-preview-detail-target-provider-preset-save-reopen-left-rail-layout-scenario-assets ✓ reopened semantic drill flows keep runtime semantic binding and detail actions visible after narrowing the setup rail");
