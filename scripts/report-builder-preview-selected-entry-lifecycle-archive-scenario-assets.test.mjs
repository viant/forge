import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-lifecycle-archive.scenario.mjs";

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
  expressions.some((expression) => expression.includes("seeded lifecycle published-snapshot record source not found") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("listReportDocumentsResponse") && expression.includes("capabilities") && expression.includes("archive")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("enabled(archive)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Archive"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("published_snapshot_capacityTrendQ3_1") && expression.includes("latest archive action preserved an immutable snapshot artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Latest shared artifact summary"]') && expression.includes('"kind": "reportBuilder.publishedSnapshot"') && expression.includes('"lifecycle": "archived"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-lifecycle-archive")),
  true,
);

const importPublishedRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle.published-snapshot.saved-record.json"));
const importListResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle.published-snapshot.list-response.json"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Published Snapshot"));
const archiveActionIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Archive");
const lifecycleMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot."));
const latestArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact"));
const inspectArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect artifact");
const artifactInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('[aria-label="Latest shared artifact summary"]'));

assert.notEqual(importPublishedRecordIndex, -1);
assert.notEqual(importListResponseIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(lifecycleMessageIndex, -1);
assert.notEqual(latestArtifactIndex, -1);
assert.notEqual(inspectArtifactIndex, -1);
assert.notEqual(artifactInspectorIndex, -1);

assert.equal(importPublishedRecordIndex < importListResponseIndex, true);
assert.equal(importListResponseIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < lifecycleMessageIndex, true);
assert.equal(lifecycleMessageIndex < latestArtifactIndex, true);
assert.equal(latestArtifactIndex < inspectArtifactIndex, true);
assert.equal(inspectArtifactIndex < artifactInspectorIndex, true);

console.log("report-builder-preview-selected-entry-lifecycle-archive-scenario-assets ✓ selected published-snapshot catalog entries can archive through the preview lifecycle bridge and surface the archived shared artifact");
