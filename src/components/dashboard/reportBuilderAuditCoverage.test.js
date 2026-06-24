import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const reportBuilderSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/ReportBuilder.jsx"),
    "utf8",
);
const exportExecutionSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/useReportBuilderExportExecution.js"),
    "utf8",
);

assert.equal(
    reportBuilderSource.includes("const reportAuditHandler = useMemo("),
    true,
    "ReportBuilder should resolve the optional report-audit handler from the host context.",
);

assert.equal(
    reportBuilderSource.includes("recordReportBuilderLifecycleAuditEvent(request"),
    true,
    "ReportBuilder should emit lifecycle/share audit events after successful saved-artifact and catalog-entry actions.",
);

assert.equal(
    reportBuilderSource.includes("recordReportBuilderViewCreationAuditEvent(result, request"),
    true,
    "ReportBuilder should emit view-creation audit events when lifecycle handlers return newly created shared artifacts.",
);

assert.equal(
    reportBuilderSource.includes("reportAuditHandler,"),
    true,
    "ReportBuilder export execution configs should receive the shared report-audit handler.",
);

assert.equal(
    exportExecutionSource.includes("recordReportBuilderExportAuditEvent(request"),
    true,
    "The shared export execution hook should emit export audit events after successful submissions.",
);

assert.equal(
    exportExecutionSource.includes("reportAuditActorRef = \"\""),
    true,
    "The shared export execution hook should accept the explicit audit actor context.",
);

console.log("reportBuilderAuditCoverage ✓ lifecycle, view-creation, and export flows remain wired to the shared report-audit contract");
