import assert from "node:assert/strict";

import audienceExportScenario from "../tests/report-builder-preview-semantic-import-audience-report-export-request.scenario.mjs";

assert.equal(audienceExportScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceExportScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceExportScenario.steps), true);
assert.ok(audienceExportScenario.steps.length > 8);

const expressions = audienceExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("pdfReportExportRequest")),
  true,
);
assert.equal(
  audienceExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.")),
  true,
);
assert.equal(
  audienceExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Source: savedPayload • Format: PDF")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportPrint\"")),
  true,
);
assert.equal(
  audienceExportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-report-export-request")),
  true,
);

console.log("report-builder-preview-audience-export-request-scenario-assets ✓ audience export-request scenario exports the expected PDF import, semantic metadata, and reportPrint assertions");
