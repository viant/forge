import assert from "node:assert/strict";

import importGetResponseScenario from "../tests/report-builder-preview-semantic-import-get-report-document-response.scenario.mjs";
import importCreatePayloadScenario from "../tests/report-builder-preview-semantic-import-create-report-document-payload.scenario.mjs";
import importUpdatePayloadScenario from "../tests/report-builder-preview-semantic-import-update-report-document-payload.scenario.mjs";

for (const scenario of [importGetResponseScenario, importCreatePayloadScenario, importUpdatePayloadScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 6);
}

const getResponseExpressions = importGetResponseScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  getResponseExpressions.some((expression) => expression.includes("payload.reportDocument.id") && expression.includes("capacity-trend.get-response.json")),
  true,
);
assert.equal(
  importGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported getReportDocument response Capacity Trend Q3.")),
  true,
);
assert.equal(
  getResponseExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  importGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("getReportDocumentResponse")),
  true,
);
assert.equal(
  importGetResponseScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-get-report-document-response")),
  true,
);

const createExpressions = importCreatePayloadScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  createExpressions.some((expression) => expression.includes("createReportDocumentPayload") && expression.includes("capacity-trend.create-report-document.json")),
  true,
);
assert.equal(
  importCreatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported createReportDocument payload Capacity Trend Q3.")),
  true,
);
assert.equal(
  createExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Imported Ad Delivery") && expression.includes("Imported Available Impressions") && expression.includes("Imported Reporting Window")),
  true,
);
assert.equal(
  importCreatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("createReportDocumentPayload")),
  true,
);
assert.equal(
  importCreatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"modelLabel\": \"Imported Ad Delivery\"")),
  true,
);
assert.equal(
  importCreatePayloadScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-create-report-document-payload")),
  true,
);

const updateExpressions = importUpdatePayloadScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  updateExpressions.some((expression) => expression.includes("updateReportDocumentPayload") && expression.includes("capacity-trend.update-report-document.json")),
  true,
);
assert.equal(
  importUpdatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported updateReportDocument payload Capacity Trend Q3.")),
  true,
);
assert.equal(
  updateExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Imported Ad Delivery") && expression.includes("Imported Available Impressions") && expression.includes("Imported Reporting Window")),
  true,
);
assert.equal(
  importUpdatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("updateReportDocumentPayload")),
  true,
);
assert.equal(
  importUpdatePayloadScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"modelLabel\": \"Imported Ad Delivery\"")),
  true,
);
assert.equal(
  importUpdatePayloadScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-update-report-document-payload")),
  true,
);

console.log("report-builder-preview-import-document-api-scenario-assets ✓ generic imported document API scenarios export the expected import, inspect, and reopen assertions");
