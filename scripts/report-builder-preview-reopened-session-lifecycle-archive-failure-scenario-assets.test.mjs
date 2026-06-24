import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopened-session-lifecycle-archive-failure.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 10);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("seeded reopened lifecycle published-snapshot record source not found") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("seeded reopened lifecycle saved-view record source not found") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("replaceLifecycleBehaviors API not available")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("reportBuilder.reopenedSession")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archive failed for Capacity Trend Q3 Published Snapshot. Preview lifecycle archive was rejected for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("buttons.includes('Archive')") && expression.includes("buttons.includes('Restore live builder')") && expression.includes("!text.includes('Latest shared artifact')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopened-session-lifecycle-archive-failure")),
  true,
);

const importPublishedRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.published-snapshot.failure.saved-record.json"));
const importSavedViewRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.saved-view.failure.saved-record.json"));
const importListResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.published-snapshot.failure.list-response.json"));
const reopenActionIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot"));
const injectFailureIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("replaceLifecycleBehaviors"));
const archiveActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("reopened archive button not found"));
const failureMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archive failed for Capacity Trend Q3 Published Snapshot."));
const steadyStateIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("buttons.includes('Archive')") && String(step.expression || "").includes("buttons.includes('Restore live builder')"));

assert.notEqual(importPublishedRecordIndex, -1);
assert.notEqual(importSavedViewRecordIndex, -1);
assert.notEqual(importListResponseIndex, -1);
assert.notEqual(reopenActionIndex, -1);
assert.notEqual(reopenedNoticeIndex, -1);
assert.notEqual(injectFailureIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(failureMessageIndex, -1);
assert.notEqual(steadyStateIndex, -1);

assert.equal(importPublishedRecordIndex < importSavedViewRecordIndex, true);
assert.equal(importSavedViewRecordIndex < importListResponseIndex, true);
assert.equal(importListResponseIndex < reopenActionIndex, true);
assert.equal(reopenActionIndex < reopenedNoticeIndex, true);
assert.equal(reopenedNoticeIndex < injectFailureIndex, true);
assert.equal(injectFailureIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < failureMessageIndex, true);
assert.equal(failureMessageIndex < steadyStateIndex, true);

console.log("report-builder-preview-reopened-session-lifecycle-archive-failure-scenario-assets ✓ reopened-session archive failures stay explicit and leave the reopened session actionable");
