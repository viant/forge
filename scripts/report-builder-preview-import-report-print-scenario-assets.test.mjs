import assert from "node:assert/strict";

import importReportPrintScenario from "../tests/report-builder-preview-semantic-import-report-print.scenario.mjs";

assert.equal(importReportPrintScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(importReportPrintScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(importReportPrintScenario.steps), true);
assert.ok(importReportPrintScenario.steps.length > 6);

const expressions = importReportPrintScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("getSeededSavedReportPayloads") && expression.includes("capacity-trend.report-print.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("payload?.reportSpec")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("imported report print notice not found")),
  true,
);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportPrint:")),
  true,
);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportPrint\"")),
  true,
);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding")),
  true,
);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Model Ad Delivery")),
  true,
);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Entity Line Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("No export snapshot") && expression.includes("!buttons.includes('Export snapshot')") && expression.includes("!buttons.includes('Review export')")),
  true,
);
const reportPrintModelIndex = importReportPrintScenario.steps.findIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic Binding"));
const noExportSnapshotIndex = importReportPrintScenario.steps.findIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("No export snapshot"));
const reportPrintInspectIndex = importReportPrintScenario.steps.findIndex((step) => step?.type === "eval" && String(step.expression || "").includes("inspect report print button not found"));
assert.equal(reportPrintModelIndex >= 0 && noExportSnapshotIndex >= 0 && reportPrintModelIndex < noExportSnapshotIndex, true);
assert.equal(noExportSnapshotIndex >= 0 && reportPrintInspectIndex >= 0 && noExportSnapshotIndex < reportPrintInspectIndex, true);
assert.equal(
  importReportPrintScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-report-print")),
  true,
);

console.log("report-builder-preview-import-report-print-scenario-assets ✓ generic imported report-print scenario exports the expected import and inspect assertions");
