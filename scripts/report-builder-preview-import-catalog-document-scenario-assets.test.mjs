import assert from "node:assert/strict";

import importSavedPayloadScenario from "../tests/report-builder-preview-semantic-import-saved-report-payload.scenario.mjs";
import importReportDocumentScenario from "../tests/report-builder-preview-semantic-import-report-document.scenario.mjs";
import importListResponseScenario from "../tests/report-builder-preview-semantic-import-list-report-documents-response.scenario.mjs";
import importGetRequestScenario from "../tests/report-builder-preview-semantic-import-get-report-document-request.scenario.mjs";

for (const scenario of [
  importSavedPayloadScenario,
  importReportDocumentScenario,
  importListResponseScenario,
  importGetRequestScenario,
]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 6);
}

const savedPayloadExpressions = importSavedPayloadScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));
assert.equal(
  savedPayloadExpressions.some((expression) => expression.includes("seeded saved report payload not found") && expression.includes("capacity-trend.saved-report-payload.json")),
  true,
);
assert.equal(
  importSavedPayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report payload Capacity Trend Q3.")),
  true,
);
assert.equal(
  importSavedPayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Trend Q3 for editing.")),
  true,
);
assert.equal(
  importSavedPayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);

const reportDocumentExpressions = importReportDocumentScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));
assert.equal(
  reportDocumentExpressions.some((expression) => expression.includes("seeded report document not found") && expression.includes("capacity-trend.report-document.json")),
  true,
);
assert.equal(
  importReportDocumentScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportDocument Capacity Trend Q3. Reopen in builder is ready.")),
  true,
);
assert.equal(
  importReportDocumentScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);

const listResponseExpressions = importListResponseScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));
assert.equal(
  listResponseExpressions.some((expression) => expression.includes("listReportDocumentsResponse") && expression.includes("imported-only.list-response.json")),
  true,
);
assert.equal(
  importListResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported listReportDocuments response with 1 entry.")),
  true,
);
assert.equal(
  importListResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Prepared getReportDocument request for importedOnlyTrendQ3.")),
  true,
);
assert.equal(
  listResponseExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Imported Ad Delivery") && expression.includes("Owner team://example/performance") && expression.includes("Imported Reporting Window")),
  true,
);
assert.equal(
  listResponseExpressions.some((expression) => expression.includes("Imported listReportDocuments response with 1 entry.") && expression.includes("Semantic Binding") && expression.includes("Model Imported Ad Delivery") && expression.includes("Owner team://example/performance")),
  true,
);
assert.equal(
  listResponseExpressions.some((expression) => expression.includes("Get ReportDocument request: Imported Only Trend Q3") && expression.includes("Semantic Binding") && expression.includes("Model Imported Ad Delivery") && expression.includes("Imported Reporting Window")),
  true,
);

const getRequestExpressions = importGetRequestScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));
assert.equal(
  getRequestExpressions.some((expression) => expression.includes("getReportDocumentRequest") && expression.includes("capacity-trend.get-report-document-request.json")),
  true,
);
assert.equal(
  importGetRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported getReportDocument request capacityTrendQ3.")),
  true,
);
assert.equal(
  importGetRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportId\": \"capacityTrendQ3\"")),
  true,
);

console.log("report-builder-preview-import-catalog-document-scenario-assets ✓ generic saved payload/report document/list response/get request scenarios export the expected import and interaction assertions");
