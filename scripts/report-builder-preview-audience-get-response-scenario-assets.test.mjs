import assert from "node:assert/strict";

import audienceGetResponseScenario from "../tests/report-builder-preview-semantic-import-audience-get-report-document-response.scenario.mjs";

assert.equal(audienceGetResponseScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceGetResponseScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceGetResponseScenario.steps), true);
assert.ok(audienceGetResponseScenario.steps.length > 10);

const expressions = audienceGetResponseScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.get-response.json")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported getReportDocument response Capacity Audience Segment Index Q3.")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Get ReportDocument response: Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment\"")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.")),
  true,
);
assert.equal(
  audienceGetResponseScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-get-report-document-response")),
  true,
);

console.log("report-builder-preview-audience-get-response-scenario-assets ✓ audience get-response scenario exports the expected import, metadata, and reopen assertions");
