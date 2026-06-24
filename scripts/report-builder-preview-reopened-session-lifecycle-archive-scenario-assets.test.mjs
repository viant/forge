import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-reopened-session-lifecycle-archive.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 15);

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
  expressions.some((expression) => expression.includes("reopened archive button not found")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!buttons.includes('Archive')") && expression.includes("buttons.includes('Share')") && expression.includes("buttons.includes('Restore live builder')")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("published_snapshot_capacityTrendQ3_1") && expression.includes("latest archive action preserved an immutable snapshot artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Latest shared artifact summary"]') && expression.includes('"lifecycle": "archived"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("reopened-session-lifecycle-archive")),
  true,
);

const importPublishedRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.published-snapshot.saved-record.json"));
const importSavedViewRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.saved-view.saved-record.json"));
const importListResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.reopened-lifecycle.published-snapshot.list-response.json"));
const reopenActionIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const reopenedNoticeIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Reopened ReportDocument: Capacity Trend Q3 Published Snapshot"));
const archiveActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("reopened archive button not found"));
const archiveMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot."));
const latestArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact"));
const artifactInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('[aria-label="Latest shared artifact summary"]'));

assert.notEqual(importPublishedRecordIndex, -1);
assert.notEqual(importSavedViewRecordIndex, -1);
assert.notEqual(importListResponseIndex, -1);
assert.notEqual(reopenActionIndex, -1);
assert.notEqual(reopenedNoticeIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(archiveMessageIndex, -1);
assert.notEqual(latestArtifactIndex, -1);
assert.notEqual(artifactInspectorIndex, -1);

assert.equal(importPublishedRecordIndex < importSavedViewRecordIndex, true);
assert.equal(importSavedViewRecordIndex < importListResponseIndex, true);
assert.equal(importListResponseIndex < reopenActionIndex, true);
assert.equal(reopenActionIndex < reopenedNoticeIndex, true);
assert.equal(reopenedNoticeIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < archiveMessageIndex, true);
assert.equal(archiveMessageIndex < latestArtifactIndex, true);
assert.equal(latestArtifactIndex < artifactInspectorIndex, true);

console.log("report-builder-preview-reopened-session-lifecycle-archive-scenario-assets ✓ reopened published snapshots can archive through the lifecycle bridge and project archived state back into the reopened session");
