import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-session.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 16);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate" && step?.index === 0),
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
  expressions.filter((expression) => expression.includes("parsed?.explorationSession?.dirty === true") && expression.includes("parsed?.explorationSession?.historyIndex === 1")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Undo"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.explorationSession?.dirty === false") && expression.includes("parsed?.explorationSession?.historyIndex === 0")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Redo"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Discard draft"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("keys.every((key)") && expression.includes("return !parsed?.explorationSession")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "reload"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-session")),
  true,
);

const startDraftIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate");
const localDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft."));
const dirtySessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.explorationSession?.dirty === true") && String(step.expression || "").includes("parsed?.explorationSession?.historyIndex === 1"));
const undoIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Undo");
const undoneSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.explorationSession?.dirty === false") && String(step.expression || "").includes("parsed?.explorationSession?.historyIndex === 0"));
const redoIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Redo");
const redoneSessionIndex = scenario.steps.findIndex((step, index) => index > redoIndex && step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.explorationSession?.dirty === true") && String(step.expression || "").includes("parsed?.explorationSession?.historyIndex === 1"));
const discardIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const clearedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("keys.every((key)") && String(step.expression || "").includes("return !parsed?.explorationSession"));
const reloadIndex = scenario.steps.findIndex((step, index) => index > clearedSessionIndex && step?.type === "reload");
const postReloadCleanIndex = scenario.steps.findIndex((step, index) => index > reloadIndex && step?.type === "waitForEval" && String(step.expression || "").includes("return !headers.includes('reach rate')"));

assert.notEqual(startDraftIndex, -1);
assert.notEqual(localDraftIndex, -1);
assert.notEqual(dirtySessionIndex, -1);
assert.notEqual(undoIndex, -1);
assert.notEqual(undoneSessionIndex, -1);
assert.notEqual(redoIndex, -1);
assert.notEqual(redoneSessionIndex, -1);
assert.notEqual(discardIndex, -1);
assert.notEqual(clearedSessionIndex, -1);
assert.notEqual(reloadIndex, -1);
assert.notEqual(postReloadCleanIndex, -1);

assert.equal(startDraftIndex < localDraftIndex, true);
assert.equal(localDraftIndex < dirtySessionIndex, true);
assert.equal(dirtySessionIndex < undoIndex, true);
assert.equal(undoIndex < undoneSessionIndex, true);
assert.equal(undoneSessionIndex < redoIndex, true);
assert.equal(redoIndex < redoneSessionIndex, true);
assert.equal(redoneSessionIndex < discardIndex, true);
assert.equal(discardIndex < clearedSessionIndex, true);
assert.equal(clearedSessionIndex < reloadIndex, true);
assert.equal(reloadIndex < postReloadCleanIndex, true);

console.log("report-builder-preview-exploration-session-scenario-assets ✓ exploration session undo/redo history and discard cleanup stay aligned with persisted draft state");
