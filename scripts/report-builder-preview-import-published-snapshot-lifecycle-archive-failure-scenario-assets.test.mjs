import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-published-snapshot-lifecycle-archive-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 8);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("seeded active published-snapshot artifact source not found") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceLifecycleBehaviors API not available")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buttons.includes('Archive')") && expression.includes("!text.includes('Latest shared artifact')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("lifecycle-archive-failure")),
  true,
);

const importArtifactIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.active-lifecycle.published-snapshot.failure.json"));
const activateRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record."));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceLifecycleBehaviors"));
const archiveActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("active saved artifact archive button not found"));
const failureMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archive failed for Capacity Trend Q3 Published Snapshot."));
const steadyStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("buttons.includes('Archive')") && String(step.expression || "").includes("!text.includes('Latest shared artifact')"));

assert.notEqual(importArtifactIndex, -1);
assert.notEqual(activateRecordIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(failureMessageIndex, -1);
assert.notEqual(steadyStateIndex, -1);

assert.equal(importArtifactIndex < activateRecordIndex, true);
assert.equal(activateRecordIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < failureMessageIndex, true);
assert.equal(failureMessageIndex < steadyStateIndex, true);

console.log("report-builder-preview-import-published-snapshot-lifecycle-archive-failure-scenario-assets ✓ active imported published-snapshot archive failures stay explicit and leave the active artifact section actionable");
