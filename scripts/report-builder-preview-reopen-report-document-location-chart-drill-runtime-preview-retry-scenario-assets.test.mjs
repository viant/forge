import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-drill-runtime-preview-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__locationDrillRetryBaseline") && expression.includes("runtimePreview")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Region =")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-drill-runtime-preview-retry")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const firstDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Region");
const retryBaselineIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("__locationDrillRetryBaseline"));
const firstRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const secondRunIndex = scenario.steps.findIndex((step, index) => index > firstRunIndex && step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Runtime preview fetch failed.')") && scenario.steps.indexOf(step) > secondRunIndex);

assert.notEqual(reopenIndex, -1);
assert.notEqual(firstDrillIndex, -1);
assert.notEqual(retryBaselineIndex, -1);
assert.notEqual(firstRunIndex, -1);
assert.notEqual(secondRunIndex, -1);
assert.notEqual(recoveredIndex, -1);

assert.equal(reopenIndex < firstDrillIndex, true);
assert.equal(firstDrillIndex < retryBaselineIndex, true);
assert.equal(retryBaselineIndex < firstRunIndex, true);
assert.equal(firstRunIndex < secondRunIndex, true);
assert.equal(secondRunIndex < recoveredIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-drill-runtime-preview-retry-scenario-assets ✓ reopened location chart drill retry restores drill runtime after rerun");
