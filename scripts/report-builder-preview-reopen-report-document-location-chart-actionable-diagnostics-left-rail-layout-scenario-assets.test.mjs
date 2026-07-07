import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-actionable-diagnostics-left-rail-layout.scenario.mjs";

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
  expressions.some((expression) => expression.includes("patchSeededSavedReportPayload") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentBlockChartInvalid")),
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
  expressions.some((expression) => expression.includes("__REPORT_BUILDER_LOCATION_CHART_ACTIONABLE_RAIL_WIDTH_BEFORE__")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderConfig API not available for left rail width.") && expression.includes("\"leftRailWidthPercent\":20")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("ariaWidth === 20") && expression.includes("Dimensions Market") && expression.includes("Measures Available Impressions") && expression.includes("Reopened compile diagnostics") && expression.includes("Runtime Diagnostics")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-actionable-diagnostics-left-rail-layout")),
  true,
);

const reopenedDiagnosticsIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened compile diagnostics"));
const semanticVisibleInvalidIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes('[aria-label=\\"Authored runtime preview\\"]') && String(step?.expression || "").includes('text.includes("Dimensions Market")'));
const narrowRailIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("patchBuilderConfig API not available for left rail width."));
const narrowRailInvalidIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Runtime Diagnostics") && String(step?.expression || "").includes("Dimensions Market"));

assert.notEqual(reopenedDiagnosticsIndex, -1);
assert.notEqual(semanticVisibleInvalidIndex, -1);
assert.notEqual(narrowRailIndex, -1);
assert.notEqual(narrowRailInvalidIndex, -1);

assert.equal(reopenedDiagnosticsIndex < semanticVisibleInvalidIndex, true);
assert.equal(semanticVisibleInvalidIndex < narrowRailIndex, true);
assert.equal(narrowRailIndex < narrowRailInvalidIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-actionable-diagnostics-left-rail-layout-scenario-assets ✓ reopened location chart diagnostics keep semantic metadata visible under a narrowed setup rail while diagnostics remain active");
