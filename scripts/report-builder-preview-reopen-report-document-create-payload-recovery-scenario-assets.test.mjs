import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopen-report-document-create-payload-recovery.scenario.mjs";

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
  expressions.some((expression) => expression.includes("replaceSemanticValidationBehaviors") && expression.includes("Semantic provider unavailable.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("capacityTrendQ3") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("clearSemanticValidationBehaviors")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload: Capacity Trend Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("CREATEREPORTDOCUMENTPAYLOAD") && expression.includes("CAPACITYTRENDQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Create ReportDocument payload summary\"]") && expression.includes(".forge-report-builder__saved-artifact-json") && expression.includes("\"reportId\": \"capacityTrendQ3\"") && expression.includes("\"semanticSummary\": {") && expression.includes("\"modelLabel\": \"Ad Delivery\"") && expression.includes("\"entityLabel\": \"Line Delivery\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic validation: Semantic provider unavailable.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Retry validation")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("create-payload-recovery")),
  true,
);

const injectValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("replaceSemanticValidationBehaviors"));
const prepareSelectedGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const validationErrorIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic validation: Semantic provider unavailable."));
const clearValidationIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("clearSemanticValidationBehaviors"));
const retryValidationIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Retry validation");
const recoveredIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')"));
const recoveredChartStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!text.includes('Semantic validation: Semantic provider unavailable.')") && String(step?.expression || "").includes("text.includes('Avails by Date and Channel')"));
const prepareCreatePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare create payload");
const payloadSummaryIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("CREATEREPORTDOCUMENTPAYLOAD") && String(step?.expression || "").includes("CAPACITYTRENDQ3"));

assert.notEqual(injectValidationIndex, -1);
assert.notEqual(prepareSelectedGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(validationErrorIndex, -1);
assert.notEqual(clearValidationIndex, -1);
assert.notEqual(retryValidationIndex, -1);
assert.notEqual(recoveredIndex, -1);
assert.notEqual(recoveredChartStateIndex, -1);
assert.notEqual(prepareCreatePayloadIndex, -1);
assert.notEqual(payloadSummaryIndex, -1);

assert.equal(injectValidationIndex < prepareSelectedGetIndex, true);
assert.equal(prepareSelectedGetIndex < reopenIndex, true);
assert.equal(reopenIndex < validationErrorIndex, true);
assert.equal(validationErrorIndex < clearValidationIndex, true);
assert.equal(clearValidationIndex < retryValidationIndex, true);
assert.equal(retryValidationIndex < recoveredIndex, true);
assert.equal(recoveredIndex <= recoveredChartStateIndex, true);
assert.equal(recoveredChartStateIndex < prepareCreatePayloadIndex, true);
assert.equal(prepareCreatePayloadIndex < payloadSummaryIndex, true);

console.log("report-builder-preview-reopen-report-document-create-payload-recovery-scenario-assets ✓ reopened semantic recovery flow restores validation state before preparing create payload");
