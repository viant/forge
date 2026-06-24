import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("buildReportBuilderDetailTargetDraftFromBinding("),
  true,
  "ReportBuilder should hydrate detail-target draft state from an existing binding when editing.",
);

assert.equal(
  source.includes("setEditingAuthoredDetailTargetRef("),
  true,
  "ReportBuilder should track the original detail-target ref while editing.",
);

assert.equal(
  source.includes("buildReportBuilderDetailTargetDraftFromTarget("),
  true,
  "ReportBuilder should hydrate detail-target draft state from an existing target preset.",
);

assert.equal(
  source.includes("resolveReportBuilderProviderDetailTargetPresets("),
  true,
  "ReportBuilder should load provider-backed detail-target presets for fresh authored routes.",
);

assert.equal(
  source.includes("mergeReportBuilderDetailTargets("),
  true,
  "ReportBuilder should merge authored and provider-backed detail-target presets before presenting route suggestions.",
);

assert.equal(
  source.includes("resolveReportBuilderDetailTargetDraftParameters("),
  true,
  "ReportBuilder should preserve existing detail-target parameters through the shared draft helper.",
);

assert.equal(
  source.includes("replacedTargetRef: editingAuthoredDetailTargetRef"),
  true,
  "ReportBuilder should pass the original target ref when rebinding an edited detail action.",
);

assert.equal(
  source.includes("validateReportBuilderDetailTargetDraft("),
  true,
  "ReportBuilder should validate detail-target drafts before applying them.",
);

assert.equal(
  source.includes("!detailTargetDraftValidation.valid"),
  true,
  "The detail-target apply button should honor validation state.",
);

assert.equal(
  source.includes("detailTargetDraftValidation.errors.map"),
  true,
  "ReportBuilder should surface detail-target draft validation errors inline.",
);

console.log("reportBuilderDetailTargetCoverage ✓ ReportBuilder wires shared detail-target draft helpers and validation into the authoring UI");
