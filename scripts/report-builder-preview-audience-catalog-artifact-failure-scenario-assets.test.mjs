import assert from "node:assert/strict";

import audienceCatalogArtifactFailureScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-artifact-failure.scenario.mjs";

assert.equal(audienceCatalogArtifactFailureScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogArtifactFailureScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogArtifactFailureScenario.steps), true);
assert.ok(audienceCatalogArtifactFailureScenario.steps.length > 12);

const expressions = audienceCatalogArtifactFailureScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.saved-report-record.artifact-failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.list-response.artifact-failure.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceExportBehaviors") && expression.includes("Could not load the preview export artifact for Capacity Audience Segment Index Q3.")),
  true,
);
assert.equal(
  audienceCatalogArtifactFailureScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Could not load the preview export artifact for Capacity Audience Segment Index Q3.")),
  true,
);
assert.equal(
  audienceCatalogArtifactFailureScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Semantic Binding") && String(step.expression || "").includes("Model Ad Delivery") && String(step.expression || "").includes("Entity Line Delivery") && String(step.expression || "").includes("Measures Audience Index")),
  true,
);
assert.equal(
  audienceCatalogArtifactFailureScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("window.__artifactDownloadCapture.filename === ''")),
  true,
);
assert.equal(
  audienceCatalogArtifactFailureScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-artifact-failure")),
  true,
);

console.log("report-builder-preview-audience-catalog-artifact-failure-scenario-assets ✓ audience selected-entry artifact failure scenario exports the expected warning and semantic metadata assertions");
