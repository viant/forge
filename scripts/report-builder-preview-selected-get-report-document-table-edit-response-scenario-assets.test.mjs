import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-get-report-document-table-edit-response.scenario.mjs";

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
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Edit Table Block dialog not found.") && expression.includes("Household Uniques column toggle not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("forge-report-runtime-table-panel") && expression.includes("title === 'Comparison Table'") && expression.includes("!text.includes('Household Uniques')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Comparison Table added to the report document.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Comparison Table updated.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("listReportDocumentsResponse")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-get-report-document-table-edit-response")),
  true,
);

const addTableIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Add table");
const editTableIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Edit Comparison Table");
const applyChangesIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply Changes");
const selectedDemoIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Selected entry: Report Builder Demo"));
const inspectListResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect list response");
const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const responseIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Get ReportDocument response: Report Builder Demo"));
const hideListResponseIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step?.text || "").includes("listReportDocumentsResponse"));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const runtimeTableIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("title === 'Comparison Table'") && String(step?.expression || "").includes("!text.includes('Household Uniques')"));

assert.notEqual(addTableIndex, -1);
assert.notEqual(editTableIndex, -1);
assert.notEqual(applyChangesIndex, -1);
assert.notEqual(selectedDemoIndex, -1);
assert.notEqual(inspectListResponseIndex, -1);
assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(responseIndex, -1);
assert.notEqual(hideListResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(runtimeTableIndex, -1);

assert.equal(addTableIndex < editTableIndex, true);
assert.equal(editTableIndex < applyChangesIndex, true);
assert.equal(applyChangesIndex < selectedDemoIndex, true);
assert.equal(selectedDemoIndex < inspectListResponseIndex, true);
assert.equal(inspectListResponseIndex < openSelectedResponseIndex, true);
assert.equal(openSelectedResponseIndex < responseIndex, true);
assert.equal(responseIndex < hideListResponseIndex, true);
assert.equal(hideListResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < runtimeTableIndex, true);

console.log("report-builder-preview-selected-get-report-document-table-edit-response-scenario-assets ✓ authored table edit persists through selected response open and reopened runtime table preview");
