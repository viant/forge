import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-lifecycle-archive-failure.scenario.mjs";

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
  expressions.some((expression) => expression.includes("seeded lifecycle published-snapshot record source not found") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceLifecycleBehaviors API not available")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportBuilder.catalogEntry")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
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
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-lifecycle-archive-failure")),
  true,
);

const importRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle.published-snapshot.saved-record.failure.json"));
const importListIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle.published-snapshot.list-response.failure.json"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceLifecycleBehaviors"));
const archiveActionIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Archive");
const failureMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archive failed for Capacity Trend Q3 Published Snapshot."));
const steadyStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("buttons.includes('Archive')") && String(step.expression || "").includes("!text.includes('Latest shared artifact')"));

assert.notEqual(importRecordIndex, -1);
assert.notEqual(importListIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(failureMessageIndex, -1);
assert.notEqual(steadyStateIndex, -1);

assert.equal(importRecordIndex < importListIndex, true);
assert.equal(importListIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < failureMessageIndex, true);
assert.equal(failureMessageIndex < steadyStateIndex, true);

console.log("report-builder-preview-selected-entry-lifecycle-archive-failure-scenario-assets ✓ selected-entry archive failures stay explicit and keep the catalog entry actionable");
