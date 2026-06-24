import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-list-report-documents-response.scenario.mjs";

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
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "selectSelector" && step?.selector === "select[aria-label=\"List response entry\"]" && step?.value === "capacityQ3"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect list response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide list response"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"List ReportDocuments response summary\"]") && expression.includes("\"kind\": \"listReportDocumentsResponse\"") && expression.includes("\"cursor\": \"next-page\"") && expression.includes("\"hasMore\": true") && expression.includes("\"title\": \"Capacity Q3\"") && expression.includes("\"title\": \"Capacity Archive\"") && expression.includes("\"title\": \"Capacity Location Q3\"") && expression.includes("\"title\": \"Capacity Trend Q3\"") && expression.includes("\"title\": \"Capacity Inventory Top Channels Q3\"") && expression.includes("\"title\": \"Capacity Locations Top Markets Q3\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"document\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("list-report-documents-response")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare list response");
const listSummaryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 7 entries"));
const selectEntryIndex = findStepIndex((step) => step?.type === "selectSelector" && step?.value === "capacityQ3");
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Q3"));
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')"));
const inspectListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect list response");
const inspectedSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("[aria-label=\"List ReportDocuments response summary\"]") && String(step.expression || "").includes("\"kind\": \"listReportDocumentsResponse\""));
const hideListIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide list response");
const hiddenAfterHideIndex = findStepIndex((step, index) => index > hideListIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"List ReportDocuments response summary\"]')"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareListIndex, -1);
assert.notEqual(listSummaryIndex, -1);
assert.notEqual(selectEntryIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(inspectListIndex, -1);
assert.notEqual(inspectedSummaryIndex, -1);
assert.notEqual(hideListIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);

assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareListIndex, true);
assert.equal(prepareListIndex < listSummaryIndex, true);
assert.equal(listSummaryIndex < selectEntryIndex, true);
assert.equal(selectEntryIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < inspectListIndex, true);
assert.equal(inspectListIndex < inspectedSummaryIndex, true);
assert.equal(inspectedSummaryIndex < hideListIndex, true);
assert.equal(hideListIndex < hiddenAfterHideIndex, true);

console.log("report-builder-preview-list-report-documents-response-scenario-assets ✓ list response follows the current saved payload flow and preserves list inspector toggle behavior");
