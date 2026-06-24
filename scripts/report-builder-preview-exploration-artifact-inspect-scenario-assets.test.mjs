import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-exploration-artifact-inspect.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length >= 14);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Save artifact"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("reportBuilder.explorationArtifact")),
  true,
);
assert.equal(
  expressions.filter((expression) => expression.includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')")).length >= 2,
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Debug draft JSON"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("reportBuilder.explorationArtifact")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"artifactId\": \"rbexploration_")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"reportSpec\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected dimensions (2)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Event Date")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Hide saved exploration artifact"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"reportSpec\": {")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("exploration-artifact-inspect")),
  true,
);

const saveArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Save artifact");
const savedArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Saved exploration artifact: Report Builder Demo"));
const hiddenBeforeInspectIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')"));
const inspectArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Debug draft JSON");
const visibleArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')"));
const artifactIdIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("\"artifactId\": \"rbexploration_"));
const hideArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Hide saved exploration artifact");
const hiddenAfterHideIndex = scenario.steps.findIndex((step, index) => index > hideArtifactIndex && step?.type === "waitForEval" && String(step.expression || "").includes("!document.querySelector('[aria-label=\"Saved exploration artifact summary\"]')"));
const hiddenPayloadIndex = findStepIndex((step) => step?.type === "assertDomNotContains" && String(step.text || "").includes("\"reportSpec\": {"));

assert.notEqual(saveArtifactIndex, -1);
assert.notEqual(savedArtifactIndex, -1);
assert.notEqual(hiddenBeforeInspectIndex, -1);
assert.notEqual(inspectArtifactIndex, -1);
assert.notEqual(visibleArtifactIndex, -1);
assert.notEqual(artifactIdIndex, -1);
assert.notEqual(hideArtifactIndex, -1);
assert.notEqual(hiddenAfterHideIndex, -1);
assert.notEqual(hiddenPayloadIndex, -1);

assert.equal(saveArtifactIndex < savedArtifactIndex, true);
assert.equal(savedArtifactIndex < hiddenBeforeInspectIndex, true);
assert.equal(hiddenBeforeInspectIndex < inspectArtifactIndex, true);
assert.equal(inspectArtifactIndex < visibleArtifactIndex, true);
assert.equal(visibleArtifactIndex < artifactIdIndex, true);
assert.equal(artifactIdIndex < hideArtifactIndex, true);
assert.equal(hideArtifactIndex < hiddenAfterHideIndex, true);
assert.equal(hiddenAfterHideIndex < hiddenPayloadIndex, true);

console.log("report-builder-preview-exploration-artifact-inspect-scenario-assets ✓ saved exploration artifact inspector stays hidden by default, reveals the expected payload, and hides cleanly again");
