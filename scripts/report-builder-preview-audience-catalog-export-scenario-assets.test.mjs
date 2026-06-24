import assert from "node:assert/strict";

import audienceCatalogExportScenario from "../tests/report-builder-preview-semantic-import-audience-list-report-documents-export-request.scenario.mjs";

assert.equal(audienceCatalogExportScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceCatalogExportScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceCatalogExportScenario.steps), true);
assert.ok(audienceCatalogExportScenario.steps.length > 14);

const expressions = audienceCatalogExportScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.saved-report-record.landscape.json")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceLandscapeFixtureState") && expression.includes("capacity-audience.list-response.landscape.json")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved report record Capacity Audience Segment Index Q3. Reopen and export are ready.")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported listReportDocuments response with 1 entry.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportExportRequest\"")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment.index\"")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"definitionRef\": \"harmonizer://feature/user.segment\"")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportPrint\"")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"width\": 792")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"height\": 612")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Capacity Audience Segment Index Q3-savedPayload-pdf-export-request.json")),
  true,
);
assert.equal(
  audienceCatalogExportScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-list-report-documents-export-request")),
  true,
);

console.log("report-builder-preview-audience-catalog-export-scenario-assets ✓ audience selected-entry export scenario exports the expected list-entry export request, semantic metadata, and print geometry assertions");
