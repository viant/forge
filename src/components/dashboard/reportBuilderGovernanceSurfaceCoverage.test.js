import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("renderShareableArtifactState(importedStandaloneExportRequestPanelState"),
  true,
  "Imported export request summaries should render the generic governance/shareable section.",
);

assert.equal(
  source.includes("renderShareableArtifactState(activeSavedArtifactSummary"),
  true,
  "Active saved artifact summaries should render the generic governance/shareable section.",
);

assert.equal(
  source.includes("renderShareableArtifactState(getReportDocumentResponseSummary"),
  true,
  "Prepared reopen bundle summaries should render the generic governance/shareable section.",
);

assert.equal(
  source.includes("renderShareableArtifactState(selectedListReportDocumentsEntrySummary"),
  true,
  "Selected catalog entry summaries should render the generic governance/shareable section.",
);

assert.equal(
  source.includes("renderShareableArtifactState(createReportDocumentPayloadSummary"),
  true,
  "Create request summaries should render the generic governance/shareable section.",
);

assert.equal(
  source.includes("renderShareableArtifactState(updateReportDocumentPayloadSummary"),
  true,
  "Update request summaries should render the generic governance/shareable section.",
);

console.log("reportBuilderGovernanceSurfaceCoverage ✓ key report summary surfaces render generic governance/shareable sections");
