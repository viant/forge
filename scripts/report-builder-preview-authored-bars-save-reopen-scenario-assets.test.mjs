import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-bars-save-reopen.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 24);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("filterBarBlock") && expression.includes("Inventory Scope") && expression.includes("paramIds: ['dateRange']")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("refinementBarBlock") && expression.includes("Inventory Trail") && expression.includes("No inventory drill path")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("beginStandaloneDraft API not available.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Prepare get response button not found.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Reopen in builder button not found.")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("removeAuthoredDocumentBlock API not available.")).length >= 2,
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"kind\": \"filterBarBlock\"") && expression.includes("\"kind\": \"refinementBarBlock\"") && expression.includes("\"emptyLabel\": \"No inventory drill path\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Inventory Scope") && expression.includes("Date Range") && expression.includes("!text.includes('Inventory Trail')") && expression.includes("!text.includes('Filters')")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"filterBarBlock\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"kind\": \"refinementBarBlock\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Inventory Scope\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Inventory Trail\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"emptyLabel\": \"No inventory drill path\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument Report Builder Demo for editing.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-bars-save-reopen")),
  true,
);

const addFilterIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("filterBarBlock") && String(step.expression || "").includes("Inventory Scope"));
const addRefinementIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("refinementBarBlock") && String(step.expression || "").includes("Inventory Trail"));
const authoredCardsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles.includes('Inventory Scope')") && String(step.expression || "").includes("titles.includes('Inventory Trail')"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"kind\": \"refinementBarBlock\""));
const removeFilterIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("inventoryScope"));
const removeRefinementIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("inventoryTrail"));
const removedCardsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!titles.includes('Inventory Scope')") && String(step.expression || "").includes("!titles.includes('Inventory Trail')"));
const reopenIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));
const reopenedCardsIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles.includes('Inventory Scope')") && String(step.expression || "").includes("titles.includes('Inventory Trail')") && scenario.steps.indexOf(step) > reopenIndex);
const reopenedRuntimeIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("text.includes('Inventory Scope')") && String(step.expression || "").includes("!text.includes('Inventory Trail')") && String(step.expression || "").includes("!text.includes('Filters')"));

assert.notEqual(addFilterIndex, -1);
assert.notEqual(addRefinementIndex, -1);
assert.notEqual(authoredCardsIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeFilterIndex, -1);
assert.notEqual(removeRefinementIndex, -1);
assert.notEqual(removedCardsIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(reopenedCardsIndex, -1);
assert.notEqual(reopenedRuntimeIndex, -1);

assert.equal(addFilterIndex < addRefinementIndex, true);
assert.equal(addRefinementIndex < authoredCardsIndex, true);
assert.equal(authoredCardsIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetIndex, true);
assert.equal(hiddenGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeFilterIndex, true);
assert.equal(removeFilterIndex < removeRefinementIndex, true);
assert.equal(removeRefinementIndex < removedCardsIndex, true);
assert.equal(removedCardsIndex < reopenIndex, true);
assert.equal(reopenIndex < reopenedCardsIndex, true);
assert.equal(reopenedCardsIndex < reopenedRuntimeIndex, true);

console.log("report-builder-preview-authored-bars-save-reopen-scenario-assets ✓ authored filter and refinement bars survive save/get/reopen while the empty refinement runtime stays hidden");
