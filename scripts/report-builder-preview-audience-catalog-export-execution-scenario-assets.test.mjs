import assert from "node:assert/strict";

import audienceCatalogExportExecutionScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-export-execution.scenario.mjs";

assert.equal(audienceCatalogExportExecutionScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogExportExecutionScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogExportExecutionScenario.steps), true);
assert.ok(audienceCatalogExportExecutionScenario.steps.length > 12);

const expressions = audienceCatalogExportExecutionScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.saved-report-record.execution.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.list-response.execution.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export submit button not found")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Accepted PDF export for Capacity Audience Segment Index Q3.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is queued.")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Export demo-export-job-1 is succeeded.")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Capacity Audience Segment Index Q3.pdf")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("%PDF-demo Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  audienceCatalogExportExecutionScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-export-execution")),
  true,
);

console.log("report-builder-preview-audience-catalog-export-execution-scenario-assets ✓ audience selected-entry export execution scenario exports the expected submit, status, and artifact assertions");
