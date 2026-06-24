import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-location-chart-second-drill-runtime-preview-retry.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceFetchBehaviors") && expression.includes("Runtime preview fetch failed.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityLocationsTopMarketsQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__locationSecondDrillBaseline")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__locationLeafDrillRetryBaseline")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Region =")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Drill to Metro Area =")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("location-chart-second-drill-runtime-preview-retry")),
  true,
);

const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const firstDrillBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__locationSecondDrillBaseline"));
const firstDrillIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__runtime-preview .forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Region");
const retryBaselineIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("__locationLeafDrillRetryBaseline"));
const retryRunIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Run" && step?.exact === true);
const retryRecoverIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Runtime preview fetch failed.')") && scenario.steps.indexOf(step) > retryRunIndex);
const secondDrillConfirmIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Drill to Metro Area =") && scenario.steps.indexOf(step) > retryRecoverIndex);

assert.notEqual(reopenIndex, -1);
assert.notEqual(firstDrillBaselineIndex, -1);
assert.notEqual(firstDrillIndex, -1);
assert.notEqual(retryBaselineIndex, -1);
assert.notEqual(retryRunIndex, -1);
assert.notEqual(retryRecoverIndex, -1);
assert.notEqual(secondDrillConfirmIndex, -1);

assert.equal(reopenIndex < firstDrillBaselineIndex, true);
assert.equal(firstDrillBaselineIndex < firstDrillIndex, true);
assert.equal(firstDrillIndex < retryBaselineIndex, true);
assert.equal(retryBaselineIndex < retryRunIndex, true);
assert.equal(retryRunIndex < retryRecoverIndex, true);
assert.equal(retryRecoverIndex < secondDrillConfirmIndex, true);

console.log("report-builder-preview-reopen-report-document-location-chart-second-drill-runtime-preview-retry-scenario-assets ✓ reopened location second drill retry restores preview and preserves nested drill state");
