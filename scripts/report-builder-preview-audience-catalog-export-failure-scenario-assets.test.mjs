import assert from "node:assert/strict";

import audienceCatalogExportFailureScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-export-failure.scenario.mjs";

assert.equal(audienceCatalogExportFailureScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogExportFailureScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogExportFailureScenario.steps), true);
assert.ok(audienceCatalogExportFailureScenario.steps.length > 9);

const expressions = audienceCatalogExportFailureScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.saved-report-record.failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.list-response.failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Renderer rejected reportPrint for audience export.")),
  true,
);
assert.equal(
  audienceCatalogExportFailureScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Renderer rejected reportPrint for audience export.")),
  true,
);
assert.equal(
  audienceCatalogExportFailureScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Unsupported chart primitive in current renderer.")),
  true,
);
assert.equal(
  audienceCatalogExportFailureScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Use a print-safe chart preset.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceCatalogExportFailureScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-export-failure")),
  true,
);

console.log("report-builder-preview-audience-catalog-export-failure-scenario-assets ✓ audience selected-entry export failure scenario exports the expected failure and semantic metadata assertions");
