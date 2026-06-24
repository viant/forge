import assert from "node:assert/strict";

import importReportSpecScenario from "../tests/report-builder-preview-semantic-import-report-spec.scenario.mjs";

assert.equal(importReportSpecScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(importReportSpecScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(importReportSpecScenario.steps), true);
assert.ok(importReportSpecScenario.steps.length > 8);

const expressions = importReportSpecScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("payload?.reportSpec") && expression.includes("capacity-trend.report-spec.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("runtime inspect report print button not found")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local runtime preview compiled directly from the imported ReportSpec file.")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("No export snapshot") && expression.includes("!buttons.includes('Export snapshot')") && expression.includes("!buttons.includes('Review export')")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportPrint\"")),
  true,
);
assert.equal(
  importReportSpecScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-report-spec")),
  true,
);

console.log("report-builder-preview-import-report-spec-scenario-assets ✓ generic imported ReportSpec scenario exports the expected import and runtime-preview inspection assertions");
