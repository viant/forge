import assert from "node:assert/strict";

import attachScenario from "../tests/report-builder-preview-semantic-import-report-fill-attach-report-spec-export-request.scenario.mjs";
import detachScenario from "../tests/report-builder-preview-semantic-import-report-fill-detach-report-spec-export-request.scenario.mjs";

for (const scenario of [attachScenario, detachScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 10);
}

const attachExpressions = attachScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  attachExpressions.some((expression) => expression.includes("getSeededSavedReportPayloads") && expression.includes("record?.exportRequest?.reportFill")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("imported runtime section not found")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportFill is attached to the imported ReportSpec runtime preview.")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("Imported export request summary") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportExportRequest\"")),
  true,
);
assert.equal(
  attachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"rowCount\": 8")),
  true,
);

const detachExpressions = detachScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  detachExpressions.some((expression) => expression.includes("Detach ReportFill")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  detachExpressions.some((expression) => expression.includes("Imported export request summary") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local runtime preview compiled directly from the imported ReportSpec file.")),
  true,
);
assert.equal(
  detachScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"rowCount\": 0")),
  true,
);

console.log("report-builder-preview-import-report-fill-export-request-scenario-assets ✓ generic imported ReportFill attach/detach export scenarios export the expected attach, detach, and export assertions");
