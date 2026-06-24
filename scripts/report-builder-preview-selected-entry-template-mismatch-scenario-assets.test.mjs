import assert from "node:assert/strict";

import scenario from "../tests/report-builder-preview-semantic-selected-entry-template-mismatch.scenario.mjs";

assert.equal(scenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(scenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(scenario.steps), true);
assert.ok(scenario.steps.length > 12);

const expressions = scenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return scenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("seeded saved-view record source not found") && expression.includes("Capacity Inventory Brief")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("listReportDocumentsResponse") && expression.includes("Market Brief")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Check reopen compatibility"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("template mismatch with its local backing report file")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("Selected list entry export request summary") && expression.includes("template mismatch") && expression.includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"')),
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
  expressions.some((expression) => expression.includes("saved_view_capacityTrendQ3_1") && expression.includes("immutable shared artifact")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Publish"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Published snapshot created for Capacity Trend Q3 Saved View.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("published_snapshot_capacityTrendQ3_2") && expression.includes("immutable snapshot artifact")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Prepared reopen bundle for capacityTrendQ3. Selected catalog entry template Market Brief does not match the local reopen artifact template Capacity Inventory Brief.")),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Reopen in builder"),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "clickRole" && step?.name === "Inspect artifact"),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes('[aria-label="Latest shared artifact summary"]') && expression.includes('"kind": "reportBuilder.publishedSnapshot"') && expression.includes('"artifactRef": "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendQ3_2"') && expression.includes('"templateLabel": "Market Brief"')),
  true,
);
assert.equal(
  scenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("selected-entry-template-mismatch")),
  true,
);

const importSavedViewIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.saved-view.template-mismatch.saved-record.json"));
const importListIndex = findStepIndex((step) => step?.type === "eval" && String(step.expression || "").includes("capacity-trend.saved-view.template-mismatch.list-response.json"));
const selectedEntryIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Selected entry: Capacity Trend Q3 Saved View"));
const compatibilityIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Check reopen compatibility");
const mismatchMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("template mismatch with its local backing report file"));
const inspectExportIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("Selected list entry export request summary") && String(step.expression || "").includes('"artifactRef": "reportBuilder.savedView://saved_view_capacityTrendQ3"'));
const shareIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Share");
const shareMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Shared view created for Capacity Trend Q3 Saved View."));
const sharedArtifactIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Latest shared artifact"));
const publishIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Publish");
const lifecycleMessageIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Published snapshot created for Capacity Trend Q3 Saved View."));
const latestArtifactIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes("published_snapshot_capacityTrendQ3_2") && String(step.expression || "").includes("immutable snapshot artifact"));
const prepareSelectedIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Prepare selected get response");
const getFeedbackIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Prepared reopen bundle for capacityTrendQ3."));
const reopenIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Reopen in builder");
const inspectArtifactIndex = findStepIndex((step) => step?.type === "clickRole" && step?.name === "Inspect artifact");
const artifactInspectorIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step.expression || "").includes('[aria-label="Latest shared artifact summary"]'));

assert.notEqual(importSavedViewIndex, -1);
assert.notEqual(importListIndex, -1);
assert.notEqual(selectedEntryIndex, -1);
assert.notEqual(compatibilityIndex, -1);
assert.notEqual(mismatchMessageIndex, -1);
assert.notEqual(inspectExportIndex, -1);
assert.notEqual(shareIndex, -1);
assert.notEqual(shareMessageIndex, -1);
assert.notEqual(sharedArtifactIndex, -1);
assert.notEqual(publishIndex, -1);
assert.notEqual(lifecycleMessageIndex, -1);
assert.notEqual(latestArtifactIndex, -1);
assert.notEqual(prepareSelectedIndex, -1);
assert.notEqual(getFeedbackIndex, -1);
assert.notEqual(reopenIndex, -1);
assert.notEqual(inspectArtifactIndex, -1);
assert.notEqual(artifactInspectorIndex, -1);

assert.equal(importSavedViewIndex < importListIndex, true);
assert.equal(importListIndex < selectedEntryIndex, true);
assert.equal(selectedEntryIndex < compatibilityIndex, true);
assert.equal(compatibilityIndex < mismatchMessageIndex, true);
assert.equal(mismatchMessageIndex < inspectExportIndex, true);
assert.equal(inspectExportIndex < shareIndex, true);
assert.equal(shareIndex < shareMessageIndex, true);
assert.equal(shareMessageIndex < sharedArtifactIndex, true);
assert.equal(sharedArtifactIndex < publishIndex, true);
assert.equal(publishIndex < lifecycleMessageIndex, true);
assert.equal(lifecycleMessageIndex < latestArtifactIndex, true);
assert.equal(latestArtifactIndex < prepareSelectedIndex, true);
assert.equal(prepareSelectedIndex < getFeedbackIndex, true);
assert.equal(getFeedbackIndex < reopenIndex, true);
assert.equal(reopenIndex < inspectArtifactIndex, true);
assert.equal(inspectArtifactIndex < artifactInspectorIndex, true);

console.log("report-builder-preview-selected-entry-template-mismatch-scenario-assets ✓ selected catalog entries with template mismatches keep export, share, publish, and reopen paths available while surfacing explicit warning context");
