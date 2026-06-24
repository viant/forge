import assert from "node:assert/strict";

import audienceCreateScenario from "../tests/report-builder-preview-semantic-import-audience-create-report-document-payload.scenario.mjs";
import audienceUpdateScenario from "../tests/report-builder-preview-semantic-import-audience-update-report-document-payload.scenario.mjs";

for (const scenario of [audienceCreateScenario, audienceUpdateScenario]) {
  assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
  assert.deepEqual(scenario.viewport, {
    width: 1280,
    height: 960,
  });
  assert.equal(Array.isArray(scenario.steps), true);
  assert.ok(scenario.steps.length > 12);
}

const createExpressions = audienceCreateScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  createExpressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.create-report-document.json")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported createReportDocument payload Capacity Audience Segment Index Q3. Reopen in builder is ready.")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Create ReportDocument payload: Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  createExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Parameters Date Range, Audience Segment") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment\"")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.")),
  true,
);
assert.equal(
  audienceCreateScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-create-report-document-payload")),
  true,
);

const updateExpressions = audienceUpdateScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  updateExpressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.update-report-document.json")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported updateReportDocument payload Capacity Audience Segment Index Q3. Reopen in builder is ready.")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Update ReportDocument payload: Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  updateExpressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Parameters Date Range, Audience Segment") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"expectedVersion\": 13")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment\"")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.")),
  true,
);
assert.equal(
  audienceUpdateScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-update-report-document-payload")),
  true,
);

console.log("report-builder-preview-audience-create-update-scenario-assets ✓ audience create/update payload scenarios export the expected import, semantic metadata, and reopen assertions");
