import assert from "node:assert/strict";

import audienceCatalogScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-response.scenario.mjs";

assert.equal(audienceCatalogScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogScenario.steps), true);
assert.ok(audienceCatalogScenario.steps.length > 18);

const expressions = audienceCatalogScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.saved-report-record.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.list-response.json")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported listReportDocuments response with 1 entry.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Imported listReportDocuments response with 1 entry.") && expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("List ReportDocuments response: 1 entries")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Audience Segment Index Q3")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Prepared getReportDocument request for capacityAudienceSegmentIndexQ3. Inspect or download it when needed.")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentRequest\"")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Prepared getReportDocument response for capacityAudienceSegmentIndexQ3. Inspect or download it when needed.")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Capacity Audience Segment Index Q3 for editing.")),
  true,
);
assert.equal(
  audienceCatalogScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-response")),
  true,
);

console.log("report-builder-preview-audience-catalog-scenario-assets ✓ audience list/get-request catalog scenario exports the expected import, request, response, and reopen assertions");
