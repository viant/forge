import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-save.scenario.mjs";

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
  scenario.steps.filter((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate").length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("parsed?.explorationSession?.sessionId")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save artifact"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.filter((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("reportBuilder.explorationArtifact")).length >= 2,
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')")).length >= 2,
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
  scenario.steps.some((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-save")),
  true,
);

const firstToggleIndex = findStepIndex((step) => step?.type === "clickSelectorContains" && step?.selector === ".forge-report-builder__measure-pill" && step?.text === "Reach Rate");
const localDraftIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Local Draft."));
const persistedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("parsed?.explorationSession?.sessionId"));
const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const savedArtifactNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo"));
const hiddenArtifactBeforeDiscardIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')"));
const discardDraftIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Discard draft");
const clearedSessionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("keys.every((key)") && String(step.expression || "").includes("return !parsed?.explorationSession"));
const artifactPersistsIndex = findStepIndex((step) => step?.type === "assertDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo"));
const hiddenArtifactAfterDiscardIndex = scenario.steps.findIndex((step, index) => index > artifactPersistsIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')"));

assert.notEqual(firstToggleIndex, -1);
assert.notEqual(localDraftIndex, -1);
assert.notEqual(persistedSessionIndex, -1);
assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(savedArtifactNoticeIndex, -1);
assert.notEqual(hiddenArtifactBeforeDiscardIndex, -1);
assert.notEqual(discardDraftIndex, -1);
assert.notEqual(clearedSessionIndex, -1);
assert.notEqual(artifactPersistsIndex, -1);
assert.notEqual(hiddenArtifactAfterDiscardIndex, -1);

assert.equal(firstToggleIndex < localDraftIndex, true);
assert.equal(localDraftIndex < persistedSessionIndex, true);
assert.equal(persistedSessionIndex < saveArtifactIndex, true);
assert.equal(saveArtifactIndex < savedArtifactNoticeIndex, true);
assert.equal(savedArtifactNoticeIndex < hiddenArtifactBeforeDiscardIndex, true);
assert.equal(hiddenArtifactBeforeDiscardIndex < discardDraftIndex, true);
assert.equal(discardDraftIndex < clearedSessionIndex, true);
assert.equal(clearedSessionIndex < artifactPersistsIndex, true);
assert.equal(artifactPersistsIndex < hiddenArtifactAfterDiscardIndex, true);

console.log("report-builder-preview-exploration-save-scenario-assets ✓ saved exploration artifacts survive draft discard while hidden inspector state and session cleanup stay correct");
