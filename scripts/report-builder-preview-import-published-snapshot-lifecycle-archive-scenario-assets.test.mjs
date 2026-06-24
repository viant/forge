import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-import-published-snapshot-lifecycle-archive.scenario.mjs";

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
  expressions.some((expression) => expression.includes("seeded active published-snapshot artifact source not found") && expression.includes("published_snapshot_capacityTrendQ3")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("text.includes('published-snapshot artifact')") && expression.includes("buttons.includes('Archive')")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("!buttons.includes('Archive')") && expression.includes("buttons.includes('Share')") && expression.includes("text.includes('archived')")),
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
  expressions.some((expression) => expression.includes('[aria-label="Latest shared artifact summary"]') && expression.includes('"lifecycle": "archived"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-published-snapshot-lifecycle-archive")),
  true,
);

const importArtifactIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.active-lifecycle.published-snapshot.json"));
const activateRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Capacity Trend Q3 Published Snapshot is now the active saved report record."));
const archiveButtonReadyIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("buttons.includes('Archive')"));
const archiveActionIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("active saved artifact archive button not found"));
const archiveMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Archived shared artifact for Capacity Trend Q3 Published Snapshot."));
const activeSectionUpdatedIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("!buttons.includes('Archive')") && String(step.expression || "").includes("buttons.includes('Share')"));
const latestArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact"));
const artifactInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('[aria-label="Latest shared artifact summary"]'));

assert.notEqual(importArtifactIndex, -1);
assert.notEqual(activateRecordIndex, -1);
assert.notEqual(archiveButtonReadyIndex, -1);
assert.notEqual(archiveActionIndex, -1);
assert.notEqual(archiveMessageIndex, -1);
assert.notEqual(activeSectionUpdatedIndex, -1);
assert.notEqual(latestArtifactIndex, -1);
assert.notEqual(artifactInspectorIndex, -1);

assert.equal(importArtifactIndex < activateRecordIndex, true);
assert.equal(activateRecordIndex < archiveButtonReadyIndex, true);
assert.equal(archiveButtonReadyIndex < archiveActionIndex, true);
assert.equal(archiveActionIndex < archiveMessageIndex, true);
assert.equal(archiveMessageIndex < activeSectionUpdatedIndex, true);
assert.equal(activeSectionUpdatedIndex < latestArtifactIndex, true);
assert.equal(latestArtifactIndex < artifactInspectorIndex, true);

console.log("report-builder-preview-import-published-snapshot-lifecycle-archive-scenario-assets ✓ active imported published-snapshot artifacts archive cleanly and the active saved artifact section reflects the archived lifecycle");
