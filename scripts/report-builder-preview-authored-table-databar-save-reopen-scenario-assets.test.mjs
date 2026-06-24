import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-table-databar-save-reopen.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("comparisonTable") && expression.includes("kind: 'dataBar'") && expression.includes("valueField: 'avails'") && expression.includes("mode: 'columnMax'")),
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
  expressions.some((expression) => expression.includes("Reopen in builder button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("comparisonTable")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("Available Impressions data bar")).length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]") && expression.includes("linear-gradient") && expression.includes("width: 0%")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"title\": \"Comparison Table\"") && expression.includes("\"kind\": \"dataBar\"") && expression.includes("\"valueField\": \"avails\"") && expression.includes("\"mode\": \"columnMax\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes(".forge-report-runtime-table-panel") && expression.includes("Comparison Table") && expression.includes("Available Impressions") && expression.includes(".forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]") && expression.includes("linear-gradient") && expression.includes("width: 0%")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Comparison Table")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"dataBar\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"valueField\": \"avails\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"mode\": \"columnMax\"")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-table-databar-save-reopen")),
  true,
);

const addTableIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("comparisonTable"));
const addTableCardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-builder__document-block-card strong") && String(step.expression || "").includes("Comparison Table"));
const databarSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Available Impressions data bar"));
const databarVisualIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]") && String(step.expression || "").includes("linear-gradient") && String(step.expression || "").includes("width: 0%"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"kind\": \"dataBar\"") && String(step.expression || "").includes("\"mode\": \"columnMax\""));
const removeTableIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available."));
const removedCardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!Array.from(document.querySelectorAll('.forge-report-builder__document-block-card strong')).some") && String(step.expression || "").includes("Comparison Table"));
const reopenIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));
const runtimeTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes(".forge-report-runtime-table-panel") && String(step.expression || "").includes("Comparison Table") && String(step.expression || "").includes(".forge-dashboard-table-cell-visual--data-bar > span[aria-hidden=\"true\"]"));

assert.notEqual(addTableIndex, -1);
assert.notEqual(addTableCardIndex, -1);
assert.notEqual(databarSummaryIndex, -1);
assert.notEqual(databarVisualIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeTableIndex, -1);
assert.notEqual(removedCardIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(runtimeTableIndex, -1);

assert.equal(addTableIndex < addTableCardIndex, true);
assert.equal(addTableCardIndex < databarSummaryIndex, true);
assert.equal(databarSummaryIndex < databarVisualIndex, true);
assert.equal(databarVisualIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetIndex, true);
assert.equal(hiddenGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeTableIndex, true);
assert.equal(removeTableIndex < removedCardIndex, true);
assert.equal(removedCardIndex < reopenIndex, true);
assert.equal(reopenIndex < runtimeTableIndex, true);

const reopenedDatabarSummaryStep = scenario.steps
  .slice(reopenIndex + 1)
  .find((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Available Impressions data bar"));

assert.notEqual(reopenedDatabarSummaryStep, undefined);

console.log("report-builder-preview-authored-table-databar-save-reopen-scenario-assets ✓ authored databar table survives save/get/reopen with inspected get payload and restored runtime preview");
