import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const activeSavedArtifactSummary = useMemo("),
  true,
  "ReportBuilder should compute an active saved-artifact summary for non-payload saved records.",
);

assert.equal(
  source.includes('label={savedReportPayloadSummary ? "Saved report file" : "Active saved artifact"}'),
  true,
  "ReportBuilder should expose an Active saved artifact summary when no saved payload is present.",
);

assert.equal(
  source.includes("activeSavedArtifactKindLabel"),
  true,
  "ReportBuilder should surface imported shared-artifact provenance labels in the active saved artifact section.",
);

assert.equal(
  source.includes("renderSemanticBindingChips(activeSavedArtifactSummary"),
  true,
  "Active saved artifact summaries should render semantic binding metadata.",
);

assert.equal(
  source.includes("savedReportPayloadExportActionState"),
  true,
  "Active saved artifact summaries should still route through the saved export action state.",
);

console.log("reportBuilderImportedSharedArtifactCoverage ✓ active saved artifacts reuse saved export controls and semantic summary rendering");
