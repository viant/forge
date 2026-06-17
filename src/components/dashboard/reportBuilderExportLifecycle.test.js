import assert from "node:assert/strict";

import {
    buildReportBuilderExportFailureNotice,
    buildReportBuilderExportArtifactDownload,
    buildReportBuilderExportRequestIdentity,
    buildReportBuilderExportJobSummary,
    isReportBuilderExportJobTerminal,
    normalizeReportBuilderExportArtifact,
    normalizeReportBuilderExportJob,
} from "./reportBuilderExportLifecycle.js";

const exportRequestIdentity = buildReportBuilderExportRequestIdentity({
    target: { format: "pdf" },
    source: { from: "savedPayload", artifactRef: "report://demo" },
    reportSpec: { title: "Forecasting Q3" },
});
assert.ok(exportRequestIdentity.includes("\"artifactRef\":\"report://demo\""));
assert.ok(exportRequestIdentity.includes("\"title\":\"Forecasting Q3\""));
assert.notEqual(exportRequestIdentity, buildReportBuilderExportRequestIdentity({
    target: { format: "pdf" },
    source: { from: "savedPayload", artifactRef: "report://demo" },
    reportSpec: { title: "Forecasting Q4" },
}));

const queuedJob = normalizeReportBuilderExportJob({
    jobId: "job-1",
    status: "queued",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
});

assert.deepEqual(queuedJob, {
    jobId: "job-1",
    status: "queued",
    artifactId: "",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    scope: "",
    error: "",
    diagnostics: [],
});
assert.equal(isReportBuilderExportJobTerminal(queuedJob), false);
assert.deepEqual(buildReportBuilderExportJobSummary(queuedJob), {
    jobId: "job-1",
    status: "queued",
    artifactId: "",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    hasArtifact: false,
    canRefresh: true,
    hasFailure: false,
    error: "",
    diagnostics: [],
    hasDiagnostics: false,
    diagnosticCount: 0,
    primaryDiagnosticMessage: "",
});

const succeededJob = normalizeReportBuilderExportJob({
    jobId: "job-2",
    status: "succeeded",
    artifactId: "artifact-1",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
    format: "pdf",
});
assert.equal(isReportBuilderExportJobTerminal(succeededJob), true);

const failedJob = normalizeReportBuilderExportJob({
    jobId: "job-3",
    status: "failed",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    error: "render failed",
});
assert.deepEqual(buildReportBuilderExportJobSummary(failedJob), {
    jobId: "job-3",
    status: "failed",
    artifactId: "",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    hasArtifact: false,
    canRefresh: false,
    hasFailure: true,
    error: "render failed",
    diagnostics: [],
    hasDiagnostics: false,
    diagnosticCount: 0,
    primaryDiagnosticMessage: "",
});

const failedWithDiagnostics = {
    jobId: "job-4",
    status: "failed",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    diagnostics: [
        {
            code: "export.renderUnsupported",
            severity: "error",
            path: "$.reportPrint.pages[0]",
            message: "Unsupported chart primitive in current renderer.",
            suggestedFix: "Use a print-safe chart preset.",
        },
    ],
};
assert.deepEqual(buildReportBuilderExportJobSummary(failedWithDiagnostics), {
    jobId: "job-4",
    status: "failed",
    artifactId: "",
    artifactRef: "dashboard.reportBuilder://demo",
    format: "pdf",
    hasArtifact: false,
    canRefresh: false,
    hasFailure: true,
    error: "",
    diagnostics: [
        {
            id: "export.renderUnsupported:0",
            code: "export.renderUnsupported",
            severity: "error",
            path: "$.reportPrint.pages[0]",
            message: "Unsupported chart primitive in current renderer.",
            suggestedFix: "Use a print-safe chart preset.",
        },
    ],
    hasDiagnostics: true,
    diagnosticCount: 1,
    primaryDiagnosticMessage: "Unsupported chart primitive in current renderer.",
});
assert.deepEqual(buildReportBuilderExportFailureNotice(failedWithDiagnostics, {
    label: "Draft export",
}), {
    title: "Draft export failed",
    description: "Unsupported chart primitive in current renderer.",
    diagnostics: [
        {
            id: "export.renderUnsupported:0",
            code: "export.renderUnsupported",
            severity: "error",
            path: "$.reportPrint.pages[0]",
            message: "Unsupported chart primitive in current renderer.",
            suggestedFix: "Use a print-safe chart preset.",
        },
    ],
});

const artifact = normalizeReportBuilderExportArtifact({
    artifactId: "artifact-1",
    contentType: "application/pdf",
    data: "JVBERg==",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3",
    jobId: "job-2",
    format: "pdf",
});
assert.equal(Array.from(artifact.bytes).join(","), "37,80,68,70");

const descriptor = buildReportBuilderExportArtifactDownload(artifact, {
    title: "Forecasting Q3",
    format: "pdf",
});
assert.equal(descriptor.filename, "Forecasting Q3.pdf");
assert.equal(descriptor.mimeType, "application/pdf");
assert.equal(Array.from(descriptor.bytes).join(","), "37,80,68,70");

console.log("reportBuilderExportLifecycle ✓ normalizes export jobs/artifacts and builds download descriptors");
