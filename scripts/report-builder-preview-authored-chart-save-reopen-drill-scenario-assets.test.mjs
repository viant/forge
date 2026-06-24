import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-chart-save-reopen-drill.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 26);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("chartBlock") && expression.includes("Capacity Trend Block") && expression.includes("seriesField: 'channelV2'")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare get response button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("trendChart")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"kind\": \"chartBlock\"") && expression.includes("\"title\": \"Capacity Trend Block\"") && expression.includes("\"seriesField\": \"channelV2\"") && expression.includes("\"blockId\": \"trendChart\"")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes(".forge-report-runtime-chart-panel") && expression.includes("Capacity Trend Block") && expression.includes(".forge-chart-legend-action")).length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected value:") && expression.includes("Display") && expression.includes("Drill to Market")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("offsetParent !== null") && expression.includes(".forge-report-runtime-refinement-chip") && expression.includes("Drill to Market = Display")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("offsetParent !== null") && expression.includes(".forge-report-runtime-refinement-chip") && expression.includes("Drill to Market = Display") && expression.includes(".forge-report-runtime-table-panel") && expression.includes("labels.includes('Market')") && expression.includes("!labels.includes('Channel')")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Block")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"seriesField\": \"channelV2\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Drill to Market = Display")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Report Builder Demo for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-chart-save-reopen-drill")),
  true,
);

const addChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("chartBlock"));
const runtimeChartBeforeDraftIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-chart-panel") && String(step.expression || "").includes("Capacity Trend Block") && String(step.expression || "").includes(".forge-chart-legend-action"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"seriesField\": \"channelV2\""));
const removeChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("trendChart"));
const removedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some") && String(step.expression || "").includes("Capacity Trend Block"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getHydratedReportDocumentSession") && String(step.expression || "").includes("demoReportBuilder"));
const runtimeChartAfterReopenIndex = scenario.steps.findIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-chart-panel") && String(step.expression || "").includes("Capacity Trend Block") && String(step.expression || "").includes(".forge-chart-legend-action"));
const selectLegendIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Capacity Trend Block legend action not found."));
const selectedValueIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected value:") && String(step.expression || "").includes("Drill to Market"));
const drillActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Capacity Trend Block drill action not found."));
const refinementChipIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("offsetParent !== null") && String(step.expression || "").includes(".forge-report-runtime-refinement-chip") && String(step.expression || "").includes("Drill to Market = Display"));
const drilledTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("offsetParent !== null") && String(step.expression || "").includes(".forge-report-runtime-refinement-chip") && String(step.expression || "").includes("Drill to Market = Display") && String(step.expression || "").includes(".forge-report-runtime-table-panel") && String(step.expression || "").includes("labels.includes('Market')"));

assert.notEqual(addChartIndex, -1);
assert.notEqual(runtimeChartBeforeDraftIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeChartIndex, -1);
assert.notEqual(removedStateIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedSessionIndex, -1);
assert.notEqual(runtimeChartAfterReopenIndex, -1);
assert.notEqual(selectLegendIndex, -1);
assert.notEqual(selectedValueIndex, -1);
assert.notEqual(drillActionIndex, -1);
assert.notEqual(refinementChipIndex, -1);
assert.notEqual(drilledTableIndex, -1);

assert.equal(addChartIndex < runtimeChartBeforeDraftIndex, true);
assert.equal(runtimeChartBeforeDraftIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetIndex, true);
assert.equal(hiddenGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeChartIndex, true);
assert.equal(removeChartIndex < removedStateIndex, true);
assert.equal(removedStateIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedSessionIndex, true);
assert.equal(reopenedSessionIndex < runtimeChartAfterReopenIndex, true);
assert.equal(runtimeChartAfterReopenIndex < selectLegendIndex, true);
assert.equal(selectLegendIndex < selectedValueIndex, true);
assert.equal(selectedValueIndex < drillActionIndex, true);
assert.equal(drillActionIndex < refinementChipIndex, true);
assert.equal(refinementChipIndex < drilledTableIndex, true);

console.log("report-builder-preview-authored-chart-save-reopen-drill-scenario-assets ✓ authored chart drill survives save/get/reopen after post-save removal");
