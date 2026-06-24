import assert from "node:assert/strict";

import importReportFillScenario from "../tests/report-builder-preview-semantic-import-report-fill.scenario.mjs";
import attachReportFillScenario from "../tests/report-builder-preview-semantic-import-report-fill-attach-report-spec.scenario.mjs";

assert.equal(importReportFillScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(importReportFillScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(importReportFillScenario.steps), true);
assert.ok(importReportFillScenario.steps.length > 7);

const importExpressions = importReportFillScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  importExpressions.some((expression) => expression.includes("getSeededSavedReportPayloads") && expression.includes("record?.exportRequest?.reportFill")),
  true,
);
assert.equal(
  importExpressions.some((expression) => expression.includes("payload?.reportSpec")),
  true,
);
assert.equal(
  importExpressions.some((expression) => expression.includes("inspect report fill button not found")),
  true,
);
assert.equal(
  importReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportFill\"")),
  true,
);
assert.equal(
  importReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  importReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  importReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
const reportFillModelIndex = importReportFillScenario.steps.findIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding"));
const reportFillInspectIndex = importReportFillScenario.steps.findIndex((step) => step?.type === "eval" && String(step.expression || "").includes("inspect report fill button not found"));
assert.equal(reportFillModelIndex >= 0 && reportFillInspectIndex >= 0 && reportFillModelIndex < reportFillInspectIndex, true);
assert.equal(
  importReportFillScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-report-fill")),
  true,
);

assert.equal(attachReportFillScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(attachReportFillScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(attachReportFillScenario.steps), true);
assert.ok(attachReportFillScenario.steps.length > 10);

const attachExpressions = attachReportFillScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  attachExpressions.some((expression) => expression.includes("payload?.reportSpec")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("record?.exportRequest?.reportFill")),
  true,
);
assert.equal(
  attachExpressions.some((expression) => expression.includes("runtime inspect report fill button not found")),
  true,
);
assert.equal(
  attachReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportFill is attached to the imported ReportSpec runtime preview.")),
  true,
);
assert.equal(
  attachReportFillScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"rowCount\": 8")),
  true,
);
assert.equal(
  attachReportFillScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-report-fill-attach-report-spec")),
  true,
);

console.log("report-builder-preview-import-report-fill-scenario-assets ✓ generic imported ReportFill scenarios export the expected import, attach, and inspect assertions");
