import assert from "node:assert/strict";

import audienceImportScenario from "../tests/report-builder-preview-semantic-import-audience-saved-report-record.scenario.mjs";

assert.equal(audienceImportScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceImportScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceImportScenario.steps), true);
assert.ok(audienceImportScenario.steps.length > 10);

const expressions = audienceImportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.saved-report-record.json")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report records")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("export-ready")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment\"")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.")),
  true,
);
assert.equal(
  audienceImportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-saved-report-record")),
  true,
);

console.log("report-builder-preview-audience-import-scenario-assets ✓ audience fixture import scenario exports the expected import, metadata, and reopen assertions");
