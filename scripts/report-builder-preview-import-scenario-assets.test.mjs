import assert from "node:assert/strict";

import flatModelImportScenario from "../tests/report-builder-preview-semantic-import-flat-model-saved-report-payload.scenario.mjs";

assert.equal(flatModelImportScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(flatModelImportScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(flatModelImportScenario.steps), true);
assert.ok(flatModelImportScenario.steps.length > 15);

const expressions = flatModelImportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("replaceSemanticModelBehaviors") && expression.includes("Audience Delivery")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("appendSeededSavedReportPayloadRecord") && expression.includes("flatAudienceSegmentQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Import report file") && expression.includes("flat-audience.saved-report-payload.json")),
  true,
);
assert.equal(
  flatModelImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report payload Flat Audience Segment Q3.")),
  true,
);
assert.equal(
  flatModelImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 1 entries")),
  true,
);
assert.equal(
  flatModelImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Flat Audience Segment Q3")),
  true,
);
assert.equal(
  flatModelImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Flat Audience Segment Q3 for editing.")),
  true,
);
assert.equal(
  flatModelImportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-flat-model-saved-report-payload")),
  true,
);

console.log("report-builder-preview-import-scenario-assets ✓ flat semantic model import scenario exports the expected override, import, list/get metadata, and reopen assertions");
