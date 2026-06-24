import assert from "node:assert/strict";

import importExportRequestScenario from "../tests/report-builder-preview-semantic-import-report-export-request.scenario.mjs";

assert.equal(importExportRequestScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(importExportRequestScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(importExportRequestScenario.steps), true);
assert.ok(importExportRequestScenario.steps.length > 8);

const expressions = importExportRequestScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("getSeededSavedReportPayloads") && expression.includes("capacity-trend.export-request.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("imported export request notice not found")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported export request:")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportExportRequest\"")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
assert.equal(
  importExportRequestScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-report-export-request")),
  true,
);

console.log("report-builder-preview-import-export-request-scenario-assets ✓ generic imported export-request scenario exports the expected import and inspect assertions");
