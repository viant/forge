import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-runtime-first-drill-inflight-retains-collection-rows.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 9);

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

const actionsReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes(".forge-report-runtime-table-panel .forge-dashboard-row-action"));
const preDrillNoDataAbsentIndex = findStepIndex((step, index) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('No data.')") && !String(step?.expression || "").includes("No headline KPI value available."));
const behaviorInjectionIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceFetchBehaviors") && String(step?.expression || "").includes("runtimepreview"));
const clickPublisherIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-runtime-table-panel .forge-dashboard-row-action" && step?.text === "Drill to Publisher");
const publisherChipIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Drill to Publisher = Display"));
const stillInFlightIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("starts === 1 && settled === 0"));
const inFlightNoDataAbsentIndex = findStepIndex((step, index) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('No data.')") && index > stillInFlightIndex);
const settledIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("starts === 1 && settled === 1"));
const finalNoDataAbsentIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('No data.')") && String(step?.expression || "").includes("No headline KPI value available."));
const retainedDrilledRowsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("Publisher") && String(step?.expression || "").includes("Acme Media"));

assert.notEqual(actionsReadyIndex, -1);
assert.notEqual(preDrillNoDataAbsentIndex, -1);
assert.notEqual(behaviorInjectionIndex, -1);
assert.notEqual(clickPublisherIndex, -1);
assert.notEqual(publisherChipIndex, -1);
assert.notEqual(stillInFlightIndex, -1);
assert.notEqual(inFlightNoDataAbsentIndex, -1);
assert.notEqual(settledIndex, -1);
assert.notEqual(finalNoDataAbsentIndex, -1);
assert.notEqual(retainedDrilledRowsIndex, -1);

assert.equal(actionsReadyIndex < preDrillNoDataAbsentIndex, true);
assert.equal(preDrillNoDataAbsentIndex < behaviorInjectionIndex, true);
assert.equal(behaviorInjectionIndex < clickPublisherIndex, true);
assert.equal(clickPublisherIndex < publisherChipIndex, true);
assert.equal(publisherChipIndex < stillInFlightIndex, true);
assert.equal(stillInFlightIndex < inFlightNoDataAbsentIndex, true);
assert.equal(inFlightNoDataAbsentIndex < settledIndex, true);
assert.equal(settledIndex < finalNoDataAbsentIndex, true);
assert.equal(finalNoDataAbsentIndex < retainedDrilledRowsIndex, true);

console.log("report-builder-preview-runtime-first-drill-inflight-retains-collection-rows-scenario-assets ✓ the first drill keeps the previously visible resolved-collection rows on screen while its runtime-preview fetch is in flight, instead of collapsing to \"No data.\"");
