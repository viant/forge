import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-pagination-no-draft.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 10);

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
  expressions.some((expression) => expression.includes("!text.includes('Local Draft')") && expression.includes("keys.every((key)") && expression.includes("!JSON.parse(raw)?.explorationSession")),
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
  expressions.some((expression) => expression.includes("firstValue.includes('May 3, 2026')") && expression.includes("!parsed?.explorationSession && parsed?.page === 2")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("pagination-no-draft")),
  true,
);

const patchPageIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("patchBuilderState") && String(step.expression || "").includes("pageSize: 4"));
const pageSizeVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("4 PAGE ROWS"));
const noDraftBeforePagingIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!text.includes('Local Draft')") && String(step.expression || "").includes("!JSON.parse(raw)?.explorationSession"));
const nextPageIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Next");
const pageTwoStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("getBuilderState()?.page === 2"));
const pageTwoVisibleIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Page 2"));
const pageTwoPersistedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("firstValue.includes('May 3, 2026')") && String(step.expression || "").includes("parsed?.page === 2"));

assert.notEqual(patchPageIndex, -1);
assert.notEqual(pageSizeVisibleIndex, -1);
assert.notEqual(noDraftBeforePagingIndex, -1);
assert.notEqual(nextPageIndex, -1);
assert.notEqual(pageTwoStateIndex, -1);
assert.notEqual(pageTwoVisibleIndex, -1);
assert.notEqual(pageTwoPersistedIndex, -1);

assert.equal(patchPageIndex < pageSizeVisibleIndex, true);
assert.equal(pageSizeVisibleIndex < noDraftBeforePagingIndex, true);
assert.equal(noDraftBeforePagingIndex < nextPageIndex, true);
assert.equal(nextPageIndex < pageTwoStateIndex, true);
assert.equal(pageTwoStateIndex < pageTwoVisibleIndex, true);
assert.equal(pageTwoVisibleIndex < pageTwoPersistedIndex, true);

console.log("report-builder-preview-pagination-no-draft-scenario-assets ✓ pagination advances cleanly without creating an exploration draft or leaking session state");
