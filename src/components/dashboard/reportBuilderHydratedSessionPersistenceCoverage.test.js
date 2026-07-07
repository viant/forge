import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
  "utf8",
);

assert.equal(
  source.includes("applyReportBuilderHydratedDocumentSessionState(currentBuilderStateRef.current || state, nextSession)"),
  true,
  "ReportBuilder should persist runtime-preview hydrated session updates against the latest builder state instead of a stale render closure.",
);

assert.equal(
  source.includes("applyReportBuilderHydratedDocumentSessionState(currentBuilderStateRef.current || state, nextHydratedSession)"),
  true,
  "ReportBuilder should persist lifecycle-driven hydrated session updates against the latest builder state instead of a stale render closure.",
);

console.log("reportBuilderHydratedSessionPersistenceCoverage ✓ hydrated session writes use the latest builder state");
