import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderExportFailureNotice,
    buildReportBuilderExportArtifactDownload,
    buildReportBuilderExportRequestIdentity,
    normalizeReportBuilderExportArtifactList,
    buildReportBuilderExportJobSummary,
    isReportBuilderExportJobTerminal,
    normalizeReportBuilderExportArtifact,
    normalizeReportBuilderExportJob,
    normalizeReportBuilderExportJobList,
} from "./reportBuilderExportLifecycle.js";
import { buildReportBuilderExportRequestInspectorState } from "./reportBuilderExportRequest.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const exportRequestIdentity = buildReportBuilderExportRequestIdentity({
    target: { format: "pdf" },
    source: { from: "savedPayload", artifactRef: "report://demo" },
    reportSpec: { title: "Capacity Q3" },
});
assert.ok(exportRequestIdentity.includes("\"artifactRef\":\"report://demo\""));
assert.ok(exportRequestIdentity.includes("\"title\":\"Capacity Q3\""));
assert.notEqual(exportRequestIdentity, buildReportBuilderExportRequestIdentity({
    target: { format: "pdf" },
    source: { from: "savedPayload", artifactRef: "report://demo" },
    reportSpec: { title: "Capacity Q4" },
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
    submittedAt: "",
    startedAt: "",
    completedAt: "",
    retentionTtlMs: 0,
});
assert.equal(isReportBuilderExportJobTerminal(queuedJob), false);
assert.deepEqual(normalizeReportBuilderExportJobList({
    jobs: [
        {
            jobId: "job-1",
            status: "queued",
            artifactRef: "dashboard.reportBuilder://demo",
            format: "pdf",
        },
        null,
    ],
}), [
    {
        jobId: "job-1",
        status: "queued",
        artifactId: "",
        artifactRef: "dashboard.reportBuilder://demo",
        format: "pdf",
        scope: "",
        error: "",
        diagnostics: [],
        submittedAt: "",
        startedAt: "",
        completedAt: "",
        retentionTtlMs: 0,
    },
]);
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

assert.deepEqual(normalizeReportBuilderExportJob({
    jobId: "job-meta",
    status: "succeeded",
    artifactId: "artifact-meta",
    artifactRef: "report://meta",
    format: "xlsx",
    submittedAt: "2026-06-13T10:00:00Z",
    startedAt: "2026-06-13T10:01:00Z",
    completedAt: "2026-06-13T10:05:00Z",
    retentionTtl: 7200000000000,
}), {
    jobId: "job-meta",
    status: "succeeded",
    artifactId: "artifact-meta",
    artifactRef: "report://meta",
    format: "xlsx",
    scope: "",
    error: "",
    diagnostics: [],
    submittedAt: "2026-06-13T10:00:00Z",
    startedAt: "2026-06-13T10:01:00Z",
    completedAt: "2026-06-13T10:05:00Z",
    retentionTtlMs: 7200000,
});

const succeededJob = normalizeReportBuilderExportJob({
    jobId: "job-2",
    status: "succeeded",
    artifactId: "artifact-1",
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
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
    additionalMetaChips: ["Market Brief", "template mismatch"],
}), {
    title: "Draft export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: ["Market Brief", "template mismatch"],
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

assert.deepEqual(normalizeReportBuilderExportArtifactList({
    artifacts: [
        {
            artifactId: "artifact-1",
            contentType: "application/pdf",
            artifactRef: "dashboard.reportBuilder://demo",
            jobId: "job-1",
            format: "pdf",
        },
        null,
    ],
}), [
    {
        artifactId: "artifact-1",
        contentType: "application/pdf",
        artifactRef: "dashboard.reportBuilder://demo",
        jobId: "job-1",
        format: "pdf",
        createdAt: "",
        retentionTtlMs: 0,
    },
]);

assert.deepEqual(normalizeReportBuilderExportArtifact({
    artifactId: "artifact-meta",
    contentType: "application/pdf",
    artifactRef: "report://meta",
    jobId: "job-meta",
    format: "pdf",
    createdAt: "2026-06-13T10:05:00Z",
    retentionTtl: 3600000000000,
}), {
    artifactId: "artifact-meta",
    contentType: "application/pdf",
    artifactRef: "report://meta",
    jobId: "job-meta",
    format: "pdf",
    createdAt: "2026-06-13T10:05:00Z",
    retentionTtlMs: 3600000,
});
assert.deepEqual(buildReportBuilderExportFailureNotice(failedWithDiagnostics, {
    label: "Imported saved-record export",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery", "Entity Line Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
}), {
    title: "Imported saved-record export failed",
    description: "Unsupported chart primitive in current renderer.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery", "Entity Line Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
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

const audienceExportInspector = buildReportBuilderExportRequestInspectorState(audienceArtifactFixture.reportExportRequest);
assert.deepEqual(buildReportBuilderExportFailureNotice(failedWithDiagnostics, {
    label: "Audience export",
    semanticBindingTitle: audienceExportInspector.semanticBindingTitle,
    semanticBindingChips: audienceExportInspector.semanticBindingChips,
    semanticBindingFieldGroups: audienceExportInspector.semanticBindingFieldGroups,
    scopeSummaryTitle: audienceExportInspector.scopeSummaryTitle,
    scopeSummaryText: audienceExportInspector.scopeSummaryText,
    scopeSummaryItems: audienceExportInspector.scopeSummaryItems,
}), {
    title: "Audience export failed",
    description: "Unsupported chart primitive in current renderer.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Market",
        "Measures Audience Index",
        "Parameters Date Range, Audience Segment",
        "Categories Location, Audience +1",
        "Lineage harmonizer://feature/location +2",
    ],
    semanticBindingFieldGroups: audienceExportInspector.semanticBindingFieldGroups,
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range • Channels • Audience Segment",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
        {
            id: "channelsFilter",
            label: "Channels",
        },
        {
            id: "audienceSegmentFilter",
            label: "Audience Segment",
        },
    ],
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
    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
    jobId: "job-2",
    format: "pdf",
});
assert.equal(Array.from(artifact.bytes).join(","), "37,80,68,70");

const descriptor = buildReportBuilderExportArtifactDownload(artifact, {
    title: "Capacity Q3",
    format: "pdf",
});
assert.equal(descriptor.filename, "Capacity Q3.pdf");
assert.equal(descriptor.mimeType, "application/pdf");
assert.equal(Array.from(descriptor.bytes).join(","), "37,80,68,70");

console.log("reportBuilderExportLifecycle ✓ normalizes export jobs/artifacts and builds download descriptors");
