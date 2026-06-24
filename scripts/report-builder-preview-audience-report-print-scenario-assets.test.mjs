import assert from "node:assert/strict";

import audienceReportPrintScenario from "../tests/report-builder-preview-semantic-import-audience-report-print.scenario.mjs";

assert.equal(audienceReportPrintScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(audienceReportPrintScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(audienceReportPrintScenario.steps), true);
assert.ok(audienceReportPrintScenario.steps.length > 7);

const expressions = audienceReportPrintScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

assert.equal(
  expressions.some((expression) => expression.includes("buildCapacityAudienceArtifactFixtureState") && expression.includes("capacity-audience.report-print.json")),
  true,
);
assert.equal(
  audienceReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportPrint Capacity Audience Segment Index Q3. Inspect or download is ready.")),
  true,
);
assert.equal(
  audienceReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported ReportPrint:")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Semantic Binding") && expression.includes("Model Ad Delivery") && expression.includes("Entity Line Delivery") && expression.includes("Measures Audience Index") && expression.includes("Date Range • Channels • Audience Segment")),
  true,
);
assert.equal(
  audienceReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"reportPrint\"")),
  true,
);
assert.equal(
  audienceReportPrintScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Capacity Audience Segment Index Q3\"")),
  true,
);
assert.equal(
  audienceReportPrintScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-audience-report-print")),
  true,
);

console.log("report-builder-preview-audience-report-print-scenario-assets ✓ audience reportPrint scenario exports the expected import, semantic metadata, and print assertions");
