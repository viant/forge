import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("buildReportBuilderSemanticResultSurfaceState"),
  true,
  "ReportBuilder should derive a semantic result-surface state for preview and report modes.",
);

assert.equal(
  source.includes("resolveReportBuilderVisibleSemanticInlineNotices"),
  true,
  "ReportBuilder should route semantic inline notices through a dedicated visibility helper instead of hard-coding report-mode suppression.",
);

assert.equal(
  source.includes("startsWith(\"Semantic binding:\")"),
  false,
  "ReportBuilder should no longer suppress the compact semantic binding notice in authored report mode.",
);

assert.equal(
  source.includes("semanticResultSurfaceState && designWorkspaceMode"),
  true,
  "ReportBuilder should keep semantic context in the design workspace instead of duplicating it above preview/report result surfaces.",
);

assert.equal(
  source.includes("aria-label=\"Semantic context summary\""),
  true,
  "ReportBuilder should expose a dedicated semantic context summary region on the result surface.",
);

assert.equal(
  source.includes("renderSemanticBindingFieldGroups(semanticResultSurfaceState"),
  true,
  "ReportBuilder should expose semantic field groups directly on the preview/report result surface, not only compact binding chips.",
);

console.log("reportBuilderSemanticResultSurfaceCoverage ✓ semantic context stays available in design without duplicating reader-facing preview/report chrome");
