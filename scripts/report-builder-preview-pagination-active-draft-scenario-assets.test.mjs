import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-pagination-active-draft.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("patchBuilderState") && expression.includes("pageSize: 4") && expression.includes("page: 1")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("4 PAGE ROWS")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("headers.includes('reach rate')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("__paginationActiveDraftBaseline") && expression.includes("session?.dirty === true")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Next"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("getBuilderState()?.page === 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Page 2")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("session.sessionId === baseline.sessionId") && expression.includes("(Array.isArray(session.history) ? session.history.length : 0) === baseline.historyLength") && expression.includes("session.historyIndex === baseline.historyIndex") && expression.includes("session.dirty === true") && expression.includes("parsed.page === 2") && expression.includes("firstValue.includes('May 3, 2026')") && expression.includes("text.includes('Local Draft.')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("pagination-active-draft")),
  true,
);

const patchPageIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("patchBuilderState") && String(step.expression || "").includes("pageSize: 4"));
const pageSizeVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("4 PAGE ROWS"));
const startDraftIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate");
const localDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft."));
const baselineIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("__paginationActiveDraftBaseline"));
const nextPageIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Next");
const pageTwoStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getBuilderState()?.page === 2"));
const pageTwoVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Page 2"));
const pageTwoPersistedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("session.sessionId === baseline.sessionId") && String(step.expression || "").includes("parsed.page === 2"));

assert.notEqual(patchPageIndex, -1);
assert.notEqual(pageSizeVisibleIndex, -1);
assert.notEqual(startDraftIndex, -1);
assert.notEqual(localDraftIndex, -1);
assert.notEqual(baselineIndex, -1);
assert.notEqual(nextPageIndex, -1);
assert.notEqual(pageTwoStateIndex, -1);
assert.notEqual(pageTwoVisibleIndex, -1);
assert.notEqual(pageTwoPersistedIndex, -1);

assert.equal(patchPageIndex < pageSizeVisibleIndex, true);
assert.equal(pageSizeVisibleIndex < startDraftIndex, true);
assert.equal(startDraftIndex < localDraftIndex, true);
assert.equal(localDraftIndex < baselineIndex, true);
assert.equal(baselineIndex < nextPageIndex, true);
assert.equal(nextPageIndex < pageTwoStateIndex, true);
assert.equal(pageTwoStateIndex < pageTwoVisibleIndex, true);
assert.equal(pageTwoVisibleIndex < pageTwoPersistedIndex, true);

console.log("report-builder-preview-pagination-active-draft-scenario-assets ✓ pagination preserves the active exploration draft session and history state");
