import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-chart-save-reopen.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 22);

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
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("chartBlock") && expression.includes("Capacity Trend Block")),
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
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"kind\": \"chartBlock\"") && expression.includes("\"title\": \"Capacity Trend Block\"") && expression.includes("\"blockId\": \"trendChart\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("data-report-builder-semantic-binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Dimensions Delivery Date, Channel") && expression.includes("Measures Available Impressions") && expression.includes("Semantic binding: Ad Delivery • Entity: Line Delivery")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes(".forge-report-builder__runtime-preview") && expression.includes(".forge-report-runtime-chart-panel") && expression.includes("Capacity Trend Block")).length >= 2,
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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"chartBlock\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Capacity Trend Block\"")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-chart-save-reopen")),
  true,
);

const addChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("chartBlock"));
const runtimeChartBeforeDraftIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__runtime-preview") && String(step.expression || "").includes(".forge-report-runtime-chart-panel") && String(step.expression || "").includes("Capacity Trend Block"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"blockId\": \"trendChart\""));
const removeChartIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("trendChart"));
const removedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some") && String(step.expression || "").includes("Capacity Trend Block"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getHydratedReportDocumentSession") && String(step.expression || "").includes("demoReportBuilder"));
const reopenedSemanticSurfaceIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("data-report-builder-semantic-binding") && String(step.expression || "").includes("Dimensions Delivery Date, Channel") && String(step.expression || "").includes("Measures Available Impressions"));
const runtimeChartAfterReopenIndex = scenario.steps.findIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__runtime-preview") && String(step.expression || "").includes(".forge-report-runtime-chart-panel") && String(step.expression || "").includes("Capacity Trend Block"));

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
assert.notEqual(reopenedSemanticSurfaceIndex, -1);
assert.notEqual(runtimeChartAfterReopenIndex, -1);

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
assert.equal(reopenedSessionIndex < reopenedSemanticSurfaceIndex, true);
assert.equal(reopenedSemanticSurfaceIndex < runtimeChartAfterReopenIndex, true);

console.log("report-builder-preview-authored-chart-save-reopen-scenario-assets ✓ authored chart block survives save/get/reopen after post-save removal");
