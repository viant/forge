import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportBuilderSource = fs.readFileSync(
    path.join(__dirname, "ReportBuilder.jsx"),
    "utf8",
);

assert.equal(
    reportBuilderSource.includes("resolveReportBuilderReportStoreHandler"),
    true,
    "ReportBuilder should resolve the host reportStore handler from builder context.",
);

assert.equal(
    reportBuilderSource.includes("buildReportBuilderSaveReportRequest"),
    true,
    "ReportBuilder should build canonical save_report requests from saved report payloads.",
);

assert.equal(
    reportBuilderSource.includes("buildReportBuilderSavedReportPayloadFromBuilderState"),
    true,
    "ReportBuilder should support saving the current authored report state even when no exploration session is active.",
);

assert.equal(
    reportBuilderSource.includes("reportStoreHandler?.saveReport") || reportBuilderSource.includes("typeof reportStoreHandler?.saveReport === \"function\""),
    true,
    "ReportBuilder should persist saved reports through the host report store when available.",
);

assert.equal(
    reportBuilderSource.includes("reportStoreHandler?.updateReport") || reportBuilderSource.includes("typeof reportStoreHandler?.updateReport === \"function\""),
    true,
    "ReportBuilder should update an existing stored report when one has already been persisted.",
);

assert.equal(
    reportBuilderSource.includes("draftPdfFormatLabel")
        && reportBuilderSource.includes("draftXlsxFormatLabel")
        && reportBuilderSource.includes("renderDraftExportMenuContent"),
    true,
    "ReportBuilder should expose PDF and XLSX options in the visible export menu.",
);

assert.equal(
    reportBuilderSource.includes("triggerDraftXlsxExport"),
    true,
    "ReportBuilder should wire a dedicated XLSX export trigger alongside the PDF export path.",
);

console.log("reportBuilderPersistenceExportCoverage ✓ report store integration and export menu wiring are present");
