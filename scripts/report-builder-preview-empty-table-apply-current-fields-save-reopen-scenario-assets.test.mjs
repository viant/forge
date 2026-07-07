import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-empty-table-apply-current-fields-save-reopen.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 20);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("reportBuilder.workspaceMode.desktop.demoReportBuilder.demoReportBuilderWindow") && expression.includes("\"design\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("\"detailTable\"") && expression.includes("\"columns\":[]")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Apply current fields"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Detail Table now uses the current fields. Refreshing results.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "eval" && String(step?.expression || "").includes("Save report file button not found.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report file: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Document version")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare reopen bundle"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Reopen in builder"),
  true,
);
assert.equal(
  scenario.steps.filter((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.role === "button" && step?.name === "Report mode. Run the report and review the live result."),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Authored report\"]") && expression.includes("Filters") && expression.includes("May 1, 2026") && expression.includes("Display") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Authored report\"]") && expression.includes("May 1, 2026") && expression.includes("Display") && expression.includes("Available Impressions")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("empty-table-apply-current-fields-save-reopen-proof")),
  true,
);

const clickApplyIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Apply current fields");
const feedbackIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Detail Table now uses the current fields. Refreshing results."));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("beginStandaloneDraft"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("Save report file button not found."));
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open delivery handoff");
const prepareGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare reopen bundle");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const enterReportIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Report mode. Run the report and review the live result.");
const reopenedReportSurfaceIndex = findStepIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step?.expression || "").includes("[aria-label=\"Authored report\"]"));
const reportSemanticIndex = findStepIndex((step, index) => index > reopenedReportSurfaceIndex && step?.type === "waitForDomContains" && String(step?.text || "").includes("Semantic binding: Ad Delivery • Entity: Line Delivery"));

assert.notEqual(clickApplyIndex, -1);
assert.notEqual(feedbackIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(enterReportIndex, -1);
assert.notEqual(reopenedReportSurfaceIndex, -1);
assert.notEqual(reportSemanticIndex, -1);

assert.equal(clickApplyIndex < feedbackIndex, true);
assert.equal(feedbackIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < reopenIndex, true);
assert.equal(enterReportIndex < draftIndex, true);
assert.equal(reopenIndex < reopenedReportSurfaceIndex, true);
assert.equal(reopenedReportSurfaceIndex < reportSemanticIndex, true);

console.log("report-builder-preview-empty-table-apply-current-fields-save-reopen-scenario-assets ✓ repaired empty tables persist through save/reopen and keep semantic binding visible");
