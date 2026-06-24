import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-get-report-document-reopen-mutation-draft.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 25);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

function findStepIndexes(predicate) {
  return scenario.steps.reduce((indexes, step, index) => {
    if (predicate(step)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

assert.equal(
  expressions.some((expression) => expression.includes("getHydratedReportDocumentSession") && expression.includes("demoReportBuilder") && expression.includes("documentVersion === 11")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("querySelectorAll('section h3')") && expression.includes("Inventory Note Copy") && expression.includes("Inventory Note") && expression.includes("bodyMatches >= 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Inventory Note Copy duplicated in the authored report document.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-get-report-document-reopen-mutation-draft")),
  true,
);

const openSelectedResponseIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Open selected response");
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const duplicateIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Duplicate Inventory Note");
const noDraftBeforeMutationIndex = scenario.steps.findIndex((step, index) => index > reopenIndex && step?.type === "assertDomNotContains" && String(step?.text || "") === "Local Draft");
const localDraftAfterMutationIndex = scenario.steps.findIndex((step, index) => index > duplicateIndex && step?.type === "waitForDomContains" && String(step?.text || "") === "Local Draft");
const reopenedNoticeIndexes = findStepIndexes((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Reopened ReportDocument: Report Builder Demo"));
const initialReopenedNoticeIndex = reopenedNoticeIndexes[0] ?? -1;
const postMutationReopenedNoticeIndex = reopenedNoticeIndexes[1] ?? -1;
const runtimeNarrativeIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("bodyMatches >= 2"));

assert.notEqual(openSelectedResponseIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(noDraftBeforeMutationIndex, -1);
assert.notEqual(duplicateIndex, -1);
assert.notEqual(localDraftAfterMutationIndex, -1);
assert.equal(reopenedNoticeIndexes.length >= 2, true);
assert.notEqual(initialReopenedNoticeIndex, -1);
assert.notEqual(postMutationReopenedNoticeIndex, -1);
assert.notEqual(runtimeNarrativeIndex, -1);

assert.equal(openSelectedResponseIndex < reopenIndex, true);
assert.equal(reopenIndex < noDraftBeforeMutationIndex, true);
assert.equal(reopenIndex < initialReopenedNoticeIndex, true);
assert.equal(noDraftBeforeMutationIndex < duplicateIndex, true);
assert.equal(duplicateIndex < localDraftAfterMutationIndex, true);
assert.equal(localDraftAfterMutationIndex < postMutationReopenedNoticeIndex, true);
assert.equal(localDraftAfterMutationIndex < runtimeNarrativeIndex, true);
assert.equal(postMutationReopenedNoticeIndex < runtimeNarrativeIndex, true);

console.log("report-builder-preview-selected-get-report-document-reopen-mutation-draft-scenario-assets ✓ reopened selected-get response becomes a fresh local draft after mutation while preserving runtime preview content");
