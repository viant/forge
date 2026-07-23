import assert from "node:assert/strict";

import {
    REPORT_EXPORT_STATUS_POLL_INTERVAL_MS,
    resolveReportBuilderExportEventSourceKind,
    resolveReportBuilderExportStatusFailure,
    resolveReportBuilderExportSubmitFailure,
    shouldAutoRefreshReportBuilderExportJob,
} from "./useReportBuilderExportExecution.js";

const emptyTimingFields = {
    submittedAt: "",
    startedAt: "",
    completedAt: "",
    retentionTtlMs: 0,
};

assert.deepEqual(
    resolveReportBuilderExportSubmitFailure({
        message: "HTTP 409 Conflict",
        toolResult: {
            jobId: "job-409",
            status: "failed",
            error: "artifact artifact-1 already exists",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
            format: "pdf",
            scope: "saved_payload",
        },
    }, {
        format: "PDF",
        title: "Capacity Q3",
    }),
    {
        job: {
            jobId: "job-409",
            status: "failed",
            artifactId: "",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
            format: "pdf",
            scope: "saved_payload",
            error: "artifact artifact-1 already exists",
            diagnostics: [],
            ...emptyTimingFields,
        },
        message: "artifact artifact-1 already exists",
    },
);

assert.deepEqual(
    resolveReportBuilderExportSubmitFailure({
        message: "HTTP 409 Conflict",
        responseEnvelope: {
            error: "reporting: already exists",
            result: {
                jobId: "job-envelope",
                status: "failed",
                error: "artifact artifact-9 already exists",
            },
        },
    }, {
        format: "PDF",
        title: "Audience Index Q3",
    }),
    {
        job: {
            jobId: "job-envelope",
            status: "failed",
            artifactId: "",
            artifactRef: "",
            format: "",
            scope: "",
            error: "artifact artifact-9 already exists",
            diagnostics: [],
            ...emptyTimingFields,
        },
        message: "artifact artifact-9 already exists",
    },
);

assert.deepEqual(
    resolveReportBuilderExportSubmitFailure(new Error("host reporting export is unavailable"), {
        format: "CSV",
        title: "Capacity Q3",
    }),
    {
        job: null,
        message: "host reporting export is unavailable",
    },
);

assert.deepEqual(
    resolveReportBuilderExportSubmitFailure(null, {
        format: "XLSX",
        title: "Pipeline Q3",
    }),
    {
        job: null,
        message: "Could not submit XLSX export for Pipeline Q3.",
    },
);

assert.deepEqual(
    resolveReportBuilderExportStatusFailure({
        message: "HTTP 500 Internal Server Error",
        toolResult: {
            jobId: "job-status-1",
            status: "failed",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
            format: "pdf",
            error: "Renderer rejected reportPrint for Market Brief.",
            diagnostics: [{
                code: "export.renderUnsupported",
                severity: "error",
                message: "Unsupported chart primitive in current renderer.",
            }],
        },
    }, {
        jobId: "job-status-1",
    }),
    {
        job: {
            jobId: "job-status-1",
            status: "failed",
            artifactId: "",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_market_brief",
            format: "pdf",
            scope: "",
            error: "Renderer rejected reportPrint for Market Brief.",
            diagnostics: [{
                code: "export.renderUnsupported",
                severity: "error",
                message: "Unsupported chart primitive in current renderer.",
            }],
            ...emptyTimingFields,
        },
        message: "Renderer rejected reportPrint for Market Brief.",
    },
);

assert.deepEqual(
    resolveReportBuilderExportStatusFailure(new Error("status endpoint unavailable"), {
        jobId: "job-status-2",
    }),
    {
        job: null,
        message: "status endpoint unavailable",
    },
);

assert.equal(REPORT_EXPORT_STATUS_POLL_INTERVAL_MS, 1500);

assert.equal(
    resolveReportBuilderExportEventSourceKind({ sourceKind: "draft", eventSourceKind: "preset" }),
    "preset",
);

assert.equal(
    resolveReportBuilderExportEventSourceKind({ sourceKind: "draft" }),
    "draft",
);

assert.equal(
    shouldAutoRefreshReportBuilderExportJob({
        jobId: "job-queued",
        status: "queued",
        artifactId: "",
    }, {
        getStatus() {},
    }),
    true,
);

assert.equal(
    shouldAutoRefreshReportBuilderExportJob({
        jobId: "job-ready",
        status: "succeeded",
        artifactId: "artifact-1",
    }, {
        getStatus() {},
    }),
    false,
);

assert.equal(
    shouldAutoRefreshReportBuilderExportJob({
        jobId: "job-failed",
        status: "failed",
        artifactId: "",
    }, {
        getStatus() {},
    }),
    false,
);

assert.equal(
    shouldAutoRefreshReportBuilderExportJob({
        jobId: "job-missing-handler",
        status: "queued",
        artifactId: "",
    }, null),
    false,
);

console.log("useReportBuilderExportExecution ✓ resolves failed export submit state from structured host errors");
