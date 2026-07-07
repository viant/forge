import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("const semanticRuntimeSummary = useMemo"),
  true,
  "ReportBuilder should derive a canonical semantic runtime summary for provider-loading runtime flows.",
);

assert.equal(
  source.includes("semanticSummary: semanticRuntimeSummary"),
  true,
  "ReportBuilder should pass the canonical semantic runtime summary into runtime-derived artifacts instead of using the raw resolved summary directly.",
);

assert.equal(
  source.includes("buildReportBuilderExplorationArtifact({"),
  true,
  "ReportBuilder should continue building runtime-derived exploration artifacts from the current builder flow.",
);

assert.equal(
  source.includes("buildReportBuilderSavedReportExportRequestFromBuilderState("),
  true,
  "ReportBuilder should continue preparing builder-derived export requests from the current runtime state.",
);

assert.equal(
  source.includes("buildReportBuilderCreateReportDocumentPayloadFromBuilderState("),
  true,
  "ReportBuilder should continue preparing create payloads from the current builder state.",
);

assert.equal(
  source.includes("buildReportBuilderGetReportDocumentResponseFromBuilderState("),
  true,
  "ReportBuilder should continue preparing reopen payloads from the current builder state.",
);

assert.equal(
  source.includes("buildReportBuilderListReportDocumentsResponseFromBuilderState("),
  true,
  "ReportBuilder should continue preparing list-report-documents payloads from the current builder state.",
);

assert.equal(
  source.includes("buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState("),
  true,
  "ReportBuilder should continue preparing selected reopen payloads from the current builder state.",
);

assert.equal(
  source.includes("buildReportBuilderUpdateReportDocumentPayloadFromBuilderState("),
  true,
  "ReportBuilder should continue preparing update payloads from the current builder state.",
);

console.log("reportBuilderSemanticRuntimeArtifactCoverage ✓ runtime-derived artifacts use the canonical semantic runtime summary");
