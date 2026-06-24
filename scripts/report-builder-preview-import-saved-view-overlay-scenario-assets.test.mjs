import assert from "node:assert/strict";

import savedViewOverlayScenario from "../tests/report-builder-preview-semantic-import-saved-view-overlay.scenario.mjs";

assert.equal(savedViewOverlayScenario.baseUrl, "http://127.0.0.1:5175");
assert.deepEqual(savedViewOverlayScenario.viewport, {
  width: 1280,
  height: 960,
});
assert.equal(Array.isArray(savedViewOverlayScenario.steps), true);
assert.ok(savedViewOverlayScenario.steps.length > 6);

const expressions = savedViewOverlayScenario.steps
  .filter((step) => step?.type === "eval" || step?.type === "waitForEval")
  .map((step) => String(step.expression || ""));

function findStepIndex(predicate) {
  return savedViewOverlayScenario.steps.findIndex(predicate);
}

assert.equal(
  expressions.some((expression) => expression.includes("buildReportBuilderDetailTargetImportedArtifactFixtureState") && expression.includes("detail-target.saved-view.overlay.json")),
  true,
);
assert.equal(
  savedViewOverlayScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported saved view Imported Detail Target Modal Saved View Overlay. Reopen is ready; export needs a local export-ready artifact.")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("saved-view overlay use button not found")),
  true,
);
assert.equal(
  savedViewOverlayScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("Imported Detail Target Modal Saved View Overlay is now the active saved report record.")),
  true,
);
assert.equal(
  savedViewOverlayScenario.steps.some((step) => step?.type === "waitForDomContains" && String(step.text || "").includes("No export snapshot")),
  true,
);
assert.equal(
  expressions.some((expression) => expression.includes("saved-view artifact") && expression.includes("No export snapshot") && expression.includes("!buttons.includes('Inspect export')")),
  true,
);
assert.equal(
  savedViewOverlayScenario.steps.some((step) => step?.type === "screenshot" && String(step.file || "").includes("import-saved-view-overlay")),
  true,
);

const importIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("detail-target.saved-view.overlay.json"));
const waitImportedIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported saved view Imported Detail Target Modal Saved View Overlay. Reopen is ready; export needs a local export-ready artifact."));
const useImportedIndex = findStepIndex((step) => step?.type === "eval" && String(step?.expression || "").includes("saved-view overlay use button not found"));
const waitActiveSavedRecordIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("Imported Detail Target Modal Saved View Overlay is now the active saved report record."));
const waitNoExportSnapshotIndex = findStepIndex((step) => step?.type === "waitForDomContains" && String(step?.text || "").includes("No export snapshot"));
const verifySectionIndex = findStepIndex((step) => step?.type === "waitForEval" && String(step?.expression || "").includes("!buttons.includes('Inspect export')"));

assert.notEqual(importIndex, -1);
assert.notEqual(waitImportedIndex, -1);
assert.notEqual(useImportedIndex, -1);
assert.notEqual(waitActiveSavedRecordIndex, -1);
assert.notEqual(waitNoExportSnapshotIndex, -1);
assert.notEqual(verifySectionIndex, -1);

assert.equal(importIndex < waitImportedIndex, true);
assert.equal(waitImportedIndex < useImportedIndex, true);
assert.equal(useImportedIndex < waitActiveSavedRecordIndex, true);
assert.equal(waitActiveSavedRecordIndex < waitNoExportSnapshotIndex, true);
assert.equal(waitNoExportSnapshotIndex < verifySectionIndex, true);

console.log("report-builder-preview-import-saved-view-overlay-scenario-assets ✓ thin saved-view imports stay reopenable and explicitly non-exportable in the builder");
