import assert from "node:assert/strict";

import audienceCatalogSubmitFailureScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-submit-failure.scenario.mjs";

assert.equal(audienceCatalogSubmitFailureScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogSubmitFailureScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogSubmitFailureScenario.steps), true);
assert.ok(audienceCatalogSubmitFailureScenario.steps.length > 9);

const expressions = audienceCatalogSubmitFailureScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.saved-report-record.submit-failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.list-response.submit-failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Preview export submit was rejected for Capacity Audience Segment Index Q3.") && expression.includes("demo-export-job-submit-failed-audience")),
  true,
);
assert.equal(
  audienceCatalogSubmitFailureScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Preview export submit was rejected for Capacity Audience Segment Index Q3.")),
  true,
);
assert.equal(
  audienceCatalogSubmitFailureScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Semantic Binding") && String(step.expression || "").includes("Model Ad Delivery") && String(step.expression || "").includes("Entity Line Delivery") && String(step.expression || "").includes("Measures Audience Index") && String(step.expression || "").includes("demo-export-job-submit-failed-audience")),
  true,
);
assert.equal(
  audienceCatalogSubmitFailureScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''")),
  true,
);
assert.equal(
  audienceCatalogSubmitFailureScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-submit-failure")),
  true,
);

console.log("report-builder-preview-audience-catalog-submit-failure-scenario-assets ✓ audience selected-entry submit failure scenario exports the expected warning and semantic metadata assertions");
