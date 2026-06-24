import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-lifecycle-share.scenario.mjs";

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
  expressions.some((expression) => expression.includes("seeded lifecycle saved-view share record source not found") && expression.includes("saved_view_capacityTrendQ3")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("listReportDocumentsResponse") && expression.includes("capabilities") && expression.includes("share")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("enabled(share) && enabled(publish)")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Share"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Shared view created for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("saved_view_capacityTrendQ3_1") && expression.includes("immutable shared artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Latest shared artifact summary"]') && expression.includes('"kind": "reportBuilder.savedView"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-lifecycle-share")),
  true,
);

const importSavedRecordIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle-share.saved-view.saved-record.json"));
const importListResponseIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.lifecycle-share.saved-view.list-response.json"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const shareActionIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Share");
const lifecycleMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Shared view created for Capacity Trend Q3 Saved View."));
const latestArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact"));
const inspectArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect artifact");
const artifactInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('[aria-label="Latest shared artifact summary"]'));

assert.notEqual(importSavedRecordIndex, -1);
assert.notEqual(importListResponseIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(shareActionIndex, -1);
assert.notEqual(lifecycleMessageIndex, -1);
assert.notEqual(latestArtifactIndex, -1);
assert.notEqual(inspectArtifactIndex, -1);
assert.notEqual(artifactInspectorIndex, -1);

assert.equal(importSavedRecordIndex < importListResponseIndex, true);
assert.equal(importListResponseIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < shareActionIndex, true);
assert.equal(shareActionIndex < lifecycleMessageIndex, true);
assert.equal(lifecycleMessageIndex < latestArtifactIndex, true);
assert.equal(latestArtifactIndex < inspectArtifactIndex, true);
assert.equal(inspectArtifactIndex < artifactInspectorIndex, true);

console.log("report-builder-preview-selected-entry-lifecycle-share-scenario-assets ✓ selected catalog entries can share through the preview lifecycle bridge and surface the latest shared artifact");
