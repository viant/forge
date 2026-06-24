import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-authored-block-duplicate-save-reopen.scenario.mjs";

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
  expressions.some((expression) => expression.includes("applyAuthoredDocumentBlock API not available.") && expression.includes("Inventory Note") && expression.includes("Author-provided inventory context.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("duplicateAuthoredDocumentBlock API not available.") && expression.includes("markdownBlock")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("moveAuthoredDocumentBlock API not available.") && expression.includes("markdownBlockCopy")),
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
  expressions.some((expression) => expression.includes("removeAuthoredDocumentBlock API not available.") && expression.includes("markdownBlock")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("[aria-label=\"Get ReportDocument response summary\"]")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("\"kind\": \"getReportDocumentResponse\"") && expression.includes("\"title\": \"Inventory Note Copy\"") && expression.includes("\"title\": \"Inventory Note\"") && expression.includes("\"blockId\": \"markdownBlockCopy\"") && expression.includes("\"blockId\": \"markdownBlock\"")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("querySelectorAll('section h3')") && expression.includes("titles[0] === 'Inventory Note Copy'") && expression.includes("titles[1] === 'Inventory Note'") && expression.includes("bodyMatches >= 2")),
  true,
);

assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Inventory Note Copy")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved report payload: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Inventory Note Copy\"")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"title\": \"Inventory Note\"")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("authored-block-duplicate-save-reopen")),
  true,
);

const addNarrativeIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("applyAuthoredDocumentBlock API not available."));
const duplicateIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("duplicateAuthoredDocumentBlock API not available."));
const initialOrderIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Inventory Note'") && String(step.expression || "").includes("titles[1] === 'Inventory Note Copy'"));
const moveUpIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("moveAuthoredDocumentBlock API not available."));
const reorderedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Inventory Note Copy'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const draftIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("beginStandaloneDraft API not available."));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const preparePayloadIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare report payload");
const prepareGetIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Prepare get response button not found."));
const hiddenGetIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"kind\": \"getReportDocumentResponse\""));
const inspectGetIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect get response");
const inspectGetPayloadIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("\"kind\": \"getReportDocumentResponse\"") && String(step.expression || "").includes("\"blockId\": \"markdownBlockCopy\"") && String(step.expression || "").includes("\"blockId\": \"markdownBlock\""));
const removeOriginalIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("removeAuthoredDocumentBlock API not available.") && String(step.expression || "").includes("markdownBlock"));
const removedStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("titles.length === 1") && String(step.expression || "").includes("Inventory Note Copy"));
const reopenIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("Reopen in builder button not found."));
const restoredOrderIndex = findStepIndex((step, index) => index > reopenIndex && step?.type === "waitForEval" && String(step.expression || "").includes("titles[0] === 'Inventory Note Copy'") && String(step.expression || "").includes("titles[1] === 'Inventory Note'"));
const runtimeNarrativeIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("querySelectorAll('section h3')") && String(step.expression || "").includes("bodyMatches >= 2"));

assert.notEqual(addNarrativeIndex, -1);
assert.notEqual(duplicateIndex, -1);
assert.notEqual(initialOrderIndex, -1);
assert.notEqual(moveUpIndex, -1);
assert.notEqual(reorderedIndex, -1);
assert.notEqual(draftIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(preparePayloadIndex, -1);
assert.notEqual(prepareGetIndex, -1);
assert.notEqual(hiddenGetIndex, -1);
assert.notEqual(inspectGetIndex, -1);
assert.notEqual(inspectGetPayloadIndex, -1);
assert.notEqual(removeOriginalIndex, -1);
assert.notEqual(removedStateIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(restoredOrderIndex, -1);
assert.notEqual(runtimeNarrativeIndex, -1);

assert.equal(addNarrativeIndex < duplicateIndex, true);
assert.equal(duplicateIndex < initialOrderIndex, true);
assert.equal(initialOrderIndex < moveUpIndex, true);
assert.equal(moveUpIndex < reorderedIndex, true);
assert.equal(reorderedIndex < draftIndex, true);
assert.equal(draftIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < preparePayloadIndex, true);
assert.equal(preparePayloadIndex < prepareGetIndex, true);
assert.equal(prepareGetIndex < hiddenGetIndex, true);
assert.equal(hiddenGetIndex < inspectGetIndex, true);
assert.equal(inspectGetIndex < inspectGetPayloadIndex, true);
assert.equal(inspectGetPayloadIndex < removeOriginalIndex, true);
assert.equal(removeOriginalIndex < removedStateIndex, true);
assert.equal(removedStateIndex < reopenIndex, true);
assert.equal(reopenIndex < restoredOrderIndex, true);
assert.equal(restoredOrderIndex < runtimeNarrativeIndex, true);

console.log("report-builder-preview-authored-block-duplicate-save-reopen-scenario-assets ✓ duplicated authored narrative survives save/get/reopen ordering after post-save mutation");
