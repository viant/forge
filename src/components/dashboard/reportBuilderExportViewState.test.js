import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderExportActionState,
    buildReportBuilderExportControlLabels,
    buildReportBuilderExportFailureNotice,
    buildReportBuilderExportJobPanelState,
    buildReportBuilderExportProvenanceMetaChips,
    buildReportBuilderExportRequestPanelState,
} from "./reportBuilderExportViewState.js";
import { buildReportBuilderExportRequestInspectorState } from "./reportBuilderExportRequest.js";
import { buildCapacityAudienceLandscapeFixtureState } from "../../reporting/fixtures/capacityAudienceLandscapeFixtureState.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const audienceLandscapeFixtureState = buildCapacityAudienceLandscapeFixtureState();

assert.deepEqual(buildReportBuilderExportProvenanceMetaChips({}), []);
assert.deepEqual(buildReportBuilderExportProvenanceMetaChips({
    backingState: "export-ready",
    backingSource: "imported saved-record",
    artifactKindLabel: "report-record artifact",
}), ["export-ready", "imported saved-record", "report-record artifact"]);

assert.deepEqual(buildReportBuilderExportControlLabels({}), {
    handlerLabel: "Export selected",
    reviewLabel: "Review export",
    inspectLabel: "Inspect export",
    hideLabel: "Hide export",
    jobLabel: "Selected export",
});

assert.deepEqual(buildReportBuilderExportControlLabels({
    fallbackSubject: "selected",
    backingSource: "imported saved-record",
}), {
    handlerLabel: "Export imported saved-record",
    reviewLabel: "Review imported saved-record export",
    inspectLabel: "Inspect imported saved-record export",
    hideLabel: "Hide imported saved-record export",
    jobLabel: "Imported saved-record export",
});

assert.deepEqual(buildReportBuilderExportControlLabels({
    fallbackSubject: "selected",
    backingSource: "imported saved-record",
    artifactKindLabel: "report-record artifact",
}), {
    handlerLabel: "Export report-record artifact",
    reviewLabel: "Review report-record artifact export",
    inspectLabel: "Inspect report-record artifact export",
    hideLabel: "Hide report-record artifact export",
    jobLabel: "Report-record artifact export",
});

assert.equal(buildReportBuilderExportActionState({}), null);

assert.deepEqual(buildReportBuilderExportActionState({
    requestSummary: {
        title: "Capacity Trend Q3",
    },
    requestOpen: false,
    submitting: true,
    reportExportHandlerAvailable: true,
    handlerLabel: "Export PDF",
    reviewLabel: "Review Export",
}), {
    submitLabel: "Export PDF",
    submitDisabled: true,
    inspectLabel: "Inspect export",
});

assert.deepEqual(buildReportBuilderExportActionState({
    requestSummary: {
        title: "Capacity Trend Q3",
    },
    requestOpen: true,
    submitting: false,
    reportExportHandlerAvailable: false,
    handlerLabel: "Export snapshot",
    reviewLabel: "Review export",
}), {
    submitLabel: "Review export",
    submitDisabled: false,
    inspectLabel: "Hide export",
});

assert.equal(buildReportBuilderExportRequestPanelState({}), null);

assert.deepEqual(buildReportBuilderExportRequestPanelState({
    requestInspector: {
        from: "draft",
        format: "PDF",
        artifactRef: "dashboard.reportBuilder://demo",
        hasReportPrint: true,
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        scopeSummaryTitle: "Filters",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for export review.",
            },
        ],
        content: "{\n  \"kind\": \"reportExportRequest\"\n}",
    },
    requestOpen: true,
    includeReportPrintChip: true,
}), {
    metaChips: ["draft", "PDF", "dashboard.reportBuilder://demo", "reportPrint", "Model Ad Delivery"],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    content: "{\n  \"kind\": \"reportExportRequest\"\n}",
});

assert.deepEqual(buildReportBuilderExportRequestPanelState({
    requestInspector: {
        from: "reopened",
        format: "PDF",
        artifactRef: "reportDocument://capacityTrendQ3",
        documentVersion: 6,
        hasReportPrint: true,
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
        scopeSummaryTitle: "Filters",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for export review.",
            },
        ],
        content: "{}",
    },
    requestOpen: true,
    includeReportPrintChip: false,
    includeDocumentVersionChip: true,
}), {
    metaChips: ["reopened", "PDF", "reportDocument://capacityTrendQ3", "v6", "Model Ad Delivery", "Entity Line Delivery"],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
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
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    content: "{}",
});

assert.deepEqual(buildReportBuilderExportRequestPanelState({
    requestInspector: {
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
        documentVersion: 4,
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        content: "{}",
    },
    requestOpen: true,
    includeDocumentVersionChip: true,
}), {
    metaChips: ["savedPayload", "PDF", "reportBuilder.savedReportPayload://rbreport_capacity_q3", "v4", "Market Brief", "template mismatch"],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    content: "{}",
});

assert.deepEqual(buildReportBuilderExportRequestPanelState({
    requestInspector: {
        from: "imported",
        format: "PDF",
        artifactRef: "reportSpec://capacityTrendQ3",
        hasReportPrint: true,
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        semanticBindingFieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
        ],
        scopeSummaryTitle: "Filters",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for export review.",
            },
        ],
        content: "{}",
    },
    requestOpen: true,
    includeReportPrintChip: true,
    additionalMetaChips: ["Attached ReportFill", "8 rows"],
}), {
    metaChips: ["imported", "PDF", "reportSpec://capacityTrendQ3", "reportPrint", "Model Ad Delivery", "Attached ReportFill", "8 rows"],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    content: "{}",
});

const audienceRequestInspector = buildReportBuilderExportRequestInspectorState(audienceArtifactFixture.reportExportRequest);
const audienceRequestPanelState = buildReportBuilderExportRequestPanelState({
    requestInspector: audienceRequestInspector,
    requestOpen: true,
    includeDocumentVersionChip: true,
});
assert.equal(audienceRequestPanelState.metaChips.includes("CSV"), true);
assert.equal(
    audienceRequestPanelState.metaChips.includes("reportBuilder.savedReportPayload://rbreport_capacity_audience_segment_index_q3"),
    true,
);
assert.equal(audienceRequestPanelState.metaChips.includes("v13"), true);
assert.equal(audienceRequestPanelState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceRequestPanelState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceRequestPanelState.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceRequestPanelState.semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    audienceRequestPanelState.semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const audiencePDFRequestInspector = buildReportBuilderExportRequestInspectorState(audienceLandscapeFixtureState.pdfExportRequest);
const audiencePDFRequestPanelState = buildReportBuilderExportRequestPanelState({
    requestInspector: audiencePDFRequestInspector,
    requestOpen: true,
    includeDocumentVersionChip: true,
    includeReportPrintChip: true,
});
assert.equal(audiencePDFRequestPanelState.metaChips.includes("PDF"), true);
assert.equal(audiencePDFRequestPanelState.metaChips.includes("reportPrint"), true);
assert.equal(audiencePDFRequestPanelState.metaChips.includes("v13"), true);
assert.equal(audiencePDFRequestPanelState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audiencePDFRequestPanelState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audiencePDFRequestPanelState.scopeSummaryText, "Date Range • Channels • Audience Segment");

assert.equal(buildReportBuilderExportRequestPanelState({
    requestInspector: {
        from: "draft",
    },
    requestOpen: false,
}), null);

assert.equal(buildReportBuilderExportJobPanelState({}), null);

assert.deepEqual(buildReportBuilderExportJobPanelState({
    jobSummary: {
        jobId: "job-1",
        status: "queued",
        artifactId: "",
        format: "pdf",
        canRefresh: true,
        hasArtifact: false,
        hasFailure: false,
        error: "",
    },
    label: "Draft export",
    title: "Capacity Trend Q3",
    statusLoading: false,
    artifactLoading: false,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
}), {
    tone: "info",
    label: "Draft export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: ["job-1", "queued"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    refreshLabel: "Refresh status",
    refreshDisabled: false,
    downloadLabel: "Download PDF",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderExportJobPanelState({
    jobSummary: {
        jobId: "job-2",
        status: "failed",
        artifactId: "artifact-7",
        format: "xlsx",
        canRefresh: false,
        hasArtifact: true,
        hasFailure: true,
        error: "render failed",
    },
    label: "Reopened export",
    title: "",
    statusLoading: true,
    artifactLoading: true,
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
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
}), {
    tone: "warning",
    label: "Reopened export",
    title: "Report",
    error: "render failed",
    metaChips: ["job-2", "failed", "artifact-7"],
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
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    refreshLabel: "Refreshing...",
    refreshDisabled: true,
    downloadLabel: "Loading XLSX...",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderExportJobPanelState({
    jobSummary: {
        jobId: "job-3",
        status: "succeeded",
        artifactId: "artifact-9",
        format: "pdf",
        canRefresh: false,
        hasArtifact: true,
        hasFailure: false,
        error: "",
    },
    label: "Imported export",
    title: "Capacity Trend Q3",
    statusLoading: false,
    artifactLoading: false,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    additionalMetaChips: ["Attached ReportFill", "8 rows"],
}), {
    tone: "info",
    label: "Imported export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: ["job-3", "succeeded", "artifact-9", "Attached ReportFill", "8 rows"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
    refreshLabel: "Refresh status",
    refreshDisabled: true,
    downloadLabel: "Download PDF",
    downloadDisabled: false,
});

assert.equal(buildReportBuilderExportFailureNotice({}), null);

assert.deepEqual(buildReportBuilderExportFailureNotice({
    hasFailure: true,
    jobId: "job-9",
    status: "failed",
    artifactId: "artifact-11",
    error: "render failed",
    diagnostics: [
        {
            code: "rendererUnavailable",
            severity: "warning",
            path: "reportPrint.blocks[0]",
            message: "Renderer unavailable for imported export.",
            suggestedFix: "Retry once the renderer is available.",
        },
    ],
}, {
    label: "Imported export",
    additionalMetaChips: ["Market Brief", "template mismatch", "Attached ReportFill", "8 rows"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
}), {
    level: "warning",
    label: "Imported export",
    title: "render failed",
    error: "render failed",
    metaChips: ["job-9", "failed", "artifact-11", "Market Brief", "template mismatch", "Attached ReportFill", "8 rows"],
    diagnostics: [
        {
            id: "rendererUnavailable:0",
            code: "rendererUnavailable",
            severity: "warning",
            path: "reportPrint.blocks[0]",
            message: "Renderer unavailable for imported export.",
            suggestedFix: "Retry once the renderer is available.",
        },
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for export review.",
        },
    ],
});

console.log("reportBuilderExportViewState ✓ derives authored export action, request, and job panel state");
