import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-drill-authored-blocks-retain-data.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 6);

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const clickPublisherIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Publisher");
const publisherChipIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Publisher = Display"));
const noDataAbsentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('No data.')") && String(step?.expression || "").includes("!text.includes('No headline KPI value available.')"));
const retainedRowsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Delivery Comparison") && String(step?.expression || "").includes("Acme Media") && String(step?.expression || "").includes("DISPLAY"));
const screenshotIndex = findStepIndex((step) => step?.type === "screenshot" && String(step?.file || "").includes("drill-authored-blocks-retain-data"));

assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(clickPublisherIndex, -1);
assert.notEqual(publisherChipIndex, -1);
assert.notEqual(noDataAbsentIndex, -1);
assert.notEqual(retainedRowsIndex, -1);
assert.notEqual(screenshotIndex, -1);

assert.equal(actionsReadyIndex < clickPublisherIndex, true);
assert.equal(clickPublisherIndex < publisherChipIndex, true);
assert.equal(publisherChipIndex < noDataAbsentIndex, true);
assert.equal(noDataAbsentIndex < retainedRowsIndex, true);
assert.equal(retainedRowsIndex < screenshotIndex, true);

console.log("report-builder-preview-runtime-drill-authored-blocks-retain-data-scenario-assets ✓ drilling the top result table keeps trailing authored runtime blocks populated instead of collapsing to \"No data.\"");
