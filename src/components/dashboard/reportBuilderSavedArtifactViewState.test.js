import assert from "node:assert/strict";

import {
    buildReportBuilderActiveSavedArtifactNoticeState,
    buildReportBuilderDraftExportActionState,
    buildReportBuilderDraftExportExecutionConfig,
    buildReportBuilderDraftExportFailureNotice,
    buildReportBuilderDraftExportJobPanelState,
    buildReportBuilderDraftExportNoticeState,
    buildReportBuilderDraftExportMetaChips,
    buildReportBuilderDraftExportRequestPanelState,
    buildReportBuilderLatestSharedArtifactSupplementalText,
    buildReportBuilderReopenedExportActionState,
    buildReportBuilderReopenedExportExecutionConfig,
    buildReportBuilderReopenedExportFailureNotice,
    buildReportBuilderReopenedExportJobPanelState,
    buildReportBuilderReopenedExportNoticeState,
    buildReportBuilderReopenedSessionNoticeState,
    buildReportBuilderReopenedExportMetaChips,
    buildReportBuilderReopenedExportRequestPanelState,
    buildReportBuilderSavedPayloadExportExecutionConfig,
    buildReportBuilderSavedPayloadExportActionState,
    buildReportBuilderSavedPayloadExportFailureNotice,
    buildReportBuilderSavedPayloadRecentExportEntries,
    buildReportBuilderSavedPayloadExportJobPanelState,
    buildReportBuilderSavedPayloadApiArtifactEntries,
    buildReportBuilderSavedPayloadExportMetaChips,
    buildReportBuilderSavedPayloadExportRequestPanelState,
    buildReportBuilderSavedArtifactViewState,
    buildReportBuilderSelectedListEntryExportExecutionConfig,
    buildReportBuilderSelectedListEntryExportActionState,
    buildReportBuilderSelectedListEntryExportFailureNotice,
    buildReportBuilderSelectedListEntryExportJobPanelState,
    buildReportBuilderSelectedListEntryExportLabels,
    buildReportBuilderSelectedListEntryExportMetaChips,
    buildReportBuilderSelectedListEntryExportRequestPanelState,
} from "./reportBuilderSavedArtifactViewState.js";

const closedState = buildReportBuilderSavedArtifactViewState();
assert.equal(closedState.loadFileLabel, "Load report file");
assert.equal(closedState.saveLabel, "Save report file");
assert.equal(closedState.savedExploration.prepareLabel, "Build report file");
assert.equal(closedState.savedExploration.inspectLabel, "Review draft snapshot");
assert.equal(closedState.savedExploration.downloadLabel, "Download draft snapshot");
assert.match(closedState.savedExploration.reuseHint, /local handoff/);
assert.equal(closedState.savedReportPayload.inspectLabel, "Review report file");
assert.equal(closedState.savedReportPayload.downloadLabel, "Download report file");
assert.equal(closedState.savedReportPayload.apiArtifactsLabel, "Open delivery handoff");
assert.equal(closedState.savedReportPayload.prepareGetResponseLabel, "Prepare reopen bundle");
assert.equal(closedState.savedReportPayload.prepareListResponseLabel, "Prepare catalog response");
assert.equal(closedState.savedReportPayload.prepareUpdatePayloadLabel, "Prepare update request");
assert.equal(closedState.savedReportPayload.prepareCreatePayloadLabel, "Prepare create request");

const openState = buildReportBuilderSavedArtifactViewState({
    savedExplorationArtifactOpen: true,
    savedReportPayloadOpen: true,
    savedReportPayloadApiArtifactsOpen: true,
});
const readyState = buildReportBuilderSavedArtifactViewState({
    preparedApiArtifactCount: 3,
});
const exportHandler = {
    submitRequest() {},
};
const feedbackSink = () => {};
const localSavedPayloads = [{ id: "saved-1" }];

assert.equal(
    buildReportBuilderLatestSharedArtifactSupplementalText({
        kind: "reportBuilder.savedView",
        lifecycle: "draft",
    }),
    "The latest share action returned an immutable shared artifact for this report.",
);

assert.equal(
    buildReportBuilderLatestSharedArtifactSupplementalText({
        kind: "reportBuilder.publishedSnapshot",
        lifecycle: "published",
    }),
    "The latest publish action returned an immutable snapshot artifact for this report.",
);

assert.equal(
    buildReportBuilderLatestSharedArtifactSupplementalText({
        kind: "reportBuilder.publishedSnapshot",
        lifecycle: "archived",
    }),
    "The latest archive action preserved an immutable snapshot artifact for this report.",
);

assert.equal(openState.savedExploration.inspectLabel, "Hide draft snapshot");
assert.equal(openState.savedExploration.inspectLabel, "Hide draft snapshot");
assert.equal(openState.savedReportPayload.inspectLabel, "Hide report file");
assert.equal(openState.savedReportPayload.apiArtifactsLabel, "Hide delivery handoff");
assert.equal(readyState.savedReportPayload.apiArtifactsLabel, "Open delivery handoff (3 ready)");

assert.deepEqual(buildReportBuilderSavedPayloadApiArtifactEntries({
    getReportDocumentResponseSummary: {
        title: "Capacity Trend Q3",
        subtitle: "Published snapshot",
        description: "Local reopen bundle ready.",
        reportId: "capacityTrendQ3",
        documentVersion: 7,
        compileStatus: "clean",
        templateLabel: "Capacity Brief",
        authoredBlockCount: 4,
        drillHierarchyCount: 2,
        detailTargetCount: 1,
    },
    getReportDocumentResponseCompileValidation: {
        valid: false,
        message: "Resolve authored chart mismatch before publishing.",
    },
    reopenReportDocumentDiagnosticSummary: {
        title: "Capacity Trend Q3",
        subtitle: "Reopen mismatch",
        description: "This report targets a different builder source.",
        message: "This ReportDocument targets a different builder source.",
        reportId: "capacityTrendQ3",
        code: "incompatibleSource",
        severity: "error",
        templateConflictLabel: "template mismatch",
        reopenSourceResolutionChips: [
            "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    listReportDocumentsResponseSummary: {
        entryCount: 12,
        cursor: "cursor-12",
        hasMore: false,
    },
    selectedListReportDocumentsEntrySummary: {
        title: "Capacity Trend Q3",
        subtitle: "Saved view",
        templateLabel: "Capacity Brief",
    },
    getReportDocumentRequestPayloadSummary: {
        kind: "getReportDocumentRequest",
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        subtitle: "Saved view",
        description: "Local get request ready.",
    },
    createReportDocumentPayloadSummary: {
        title: "Capacity Trend Q3",
        subtitle: "Create ready",
        description: "Create payload prepared from the current report file.",
        reportId: "capacityTrendQ3",
        compileStatus: "clean",
        blockCount: 6,
        datasetCount: 2,
        templateLabel: "Capacity Brief",
        reopenSourceResolutionChips: [
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    createReportDocumentPayloadOpen: true,
    updateReportDocumentPayloadSummary: {
        title: "Capacity Trend Q3",
        subtitle: "Update ready",
        description: "Update payload prepared from the current report file.",
        reportId: "capacityTrendQ3",
        expectedVersion: 8,
        compileStatus: "clean",
        blockCount: 6,
        datasetCount: 2,
        templateLabel: "Capacity Brief",
        reopenSourceResolutionChips: [
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    updateReportDocumentConflictDiagnosticSummary: {
        title: "Capacity Trend Q3",
        subtitle: "Version conflict",
        description: "The current version conflicts with the expected version.",
        message: "Current version 9 conflicts with expected version 8.",
        reportId: "capacityTrendQ3",
        expectedVersion: 8,
        currentVersion: 9,
        code: "versionConflict",
        severity: "warning",
    },
})?.map((entry) => ({
    id: entry.id,
    label: entry.label,
    title: entry.title,
    inspectLabel: entry.inspectLabel,
    downloadLabel: entry.downloadLabel,
    noticeMessage: entry.notice?.message || "",
    metaChips: entry.metaChips,
})), [
    {
        id: "getReportDocumentResponse",
        label: "Reopen bundle",
        title: "Capacity Trend Q3",
        inspectLabel: "Review reopen bundle",
        downloadLabel: "Download reopen bundle file",
        noticeMessage: "Persisted compile warning: Resolve authored chart mismatch before publishing.",
        metaChips: [
            "capacityTrendQ3",
            "v7",
            "clean",
            "Capacity Brief",
            "4 authored blocks",
            "2 drill hierarchies",
            "1 detail targets",
        ],
    },
    {
        id: "reopenReportDocumentDiagnostic",
        label: "Reopen diagnostic",
        title: "Capacity Trend Q3",
        inspectLabel: "Review reopen diagnostic",
        downloadLabel: "Download reopen diagnostic file",
        noticeMessage: "",
        metaChips: [
            "capacityTrendQ3",
            "incompatibleSource",
            "error",
            "template mismatch",
            "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    {
        id: "listReportDocumentsResponse",
        label: "Catalog response",
        title: "12 entries",
        inspectLabel: "Review catalog response",
        downloadLabel: "Download catalog response file",
        noticeMessage: "",
        metaChips: [
            "cursor-12",
            "complete",
            "Capacity Brief",
        ],
    },
    {
        id: "getReportDocumentRequest",
        label: "Get request",
        title: "Capacity Trend Q3",
        inspectLabel: "Review get request",
        downloadLabel: "Download get request file",
        noticeMessage: "",
        metaChips: [
            "getReportDocumentRequest",
            "capacityTrendQ3",
        ],
    },
    {
        id: "createReportDocumentPayload",
        label: "Create request",
        title: "Capacity Trend Q3",
        inspectLabel: "Hide create request",
        downloadLabel: "Download create request file",
        noticeMessage: "",
        metaChips: [
            "capacityTrendQ3",
            "clean",
            "6 blocks",
            "2 datasets",
            "Capacity Brief",
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    {
        id: "updateReportDocumentPayload",
        label: "Update request",
        title: "Capacity Trend Q3",
        inspectLabel: "Review update request",
        downloadLabel: "Download update request file",
        noticeMessage: "",
        metaChips: [
            "capacityTrendQ3",
            "v8",
            "clean",
            "6 blocks",
            "2 datasets",
            "Capacity Brief",
            "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
        ],
    },
    {
        id: "updateReportDocumentConflictDiagnostic",
        label: "Conflict diagnostic",
        title: "Capacity Trend Q3",
        inspectLabel: "Review conflict diagnostic",
        downloadLabel: "Download conflict diagnostic file",
        noticeMessage: "",
        metaChips: [
            "capacityTrendQ3",
            "expected v8",
            "current v9",
            "versionConflict",
            "warning",
        ],
    },
]);

assert.deepEqual(buildReportBuilderSavedPayloadApiArtifactEntries({
    getReportDocumentResponseSummary: {
        title: "Capacity Trend Q3",
        reportId: "capacityTrendQ3",
        documentVersion: 7,
        compileStatus: "clean",
        shareableMetaChips: ["published", "Certified"],
    },
    listReportDocumentsResponseSummary: {
        entryCount: 12,
        cursor: "cursor-12",
        hasMore: false,
    },
    selectedListReportDocumentsEntrySummary: {
        title: "Capacity Trend Q3",
        shareableMetaChips: ["published", "Certified"],
    },
})?.map((entry) => ({
    id: entry.id,
    metaChips: entry.metaChips,
})), [
    {
        id: "getReportDocumentResponse",
        metaChips: [
            "capacityTrendQ3",
            "v7",
            "clean",
            "published",
            "Certified",
        ],
    },
    {
        id: "listReportDocumentsResponse",
        metaChips: [
            "cursor-12",
            "complete",
            "published",
            "Certified",
        ],
    },
]);

assert.deepEqual(buildReportBuilderDraftExportExecutionConfig({
    request: { id: "draft-request" },
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
}), {
    request: { id: "draft-request" },
    sourceKind: "draft",
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
    missingRequestMessage: "No draft export request is available.",
    missingJobMessage: "No draft export job is available to refresh.",
    missingArtifactMessage: "No completed draft export artifact is available yet.",
});

assert.deepEqual(buildReportBuilderSavedPayloadExportExecutionConfig({
    request: { id: "saved-request" },
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
}), {
    request: { id: "saved-request" },
    sourceKind: "savedPayload",
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
    missingRequestMessage: "No canonical saved export snapshot is available for this report payload yet.",
    missingJobMessage: "No saved export job is available to refresh.",
    missingArtifactMessage: "No completed saved export artifact is available yet.",
    historyEnabled: true,
});

assert.deepEqual(buildReportBuilderReopenedExportExecutionConfig({
    request: { id: "reopened-request" },
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
}), {
    request: { id: "reopened-request" },
    sourceKind: "reopened",
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
    missingRequestMessage: "No canonical export snapshot is available for the reopened ReportDocument.",
    missingJobMessage: "No reopened export job is available to refresh.",
    missingArtifactMessage: "No completed reopened export artifact is available yet.",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportExecutionConfig({
    request: { id: "list-request" },
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
}), {
    request: { id: "list-request" },
    sourceKind: "listEntry",
    localSavedPayloads,
    reportExportHandler: exportHandler,
    setFeedback: feedbackSink,
    missingRequestMessage: "No canonical export snapshot is available for the selected catalog entry.",
    missingJobMessage: "No selected export job is available to refresh.",
    missingArtifactMessage: "No completed selected export artifact is available yet.",
});

assert.deepEqual(buildReportBuilderActiveSavedArtifactNoticeState({
    summary: {
        compileStatus: "clean",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
        authoredBlockCount: 4,
        drillHierarchyCount: 2,
        detailTargetCount: 1,
        blockCount: 6,
        datasetCount: 2,
    },
    savedReportPayloadSummary: { kind: "reportBuilder.savedReportPayload" },
    reuseHint: "Download this report file to reopen it locally.",
    isSavedReportPayload: true,
}), {
    level: "info",
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    reuseHint: "Download this report file to reopen it locally.",
    metaChips: [
        "clean",
        "Market Brief",
        "template mismatch",
        "4 authored blocks",
        "2 drill hierarchies",
        "1 detail targets",
        "6 blocks",
        "2 datasets",
    ],
});

assert.deepEqual(buildReportBuilderActiveSavedArtifactNoticeState({
    summary: {
        compileStatus: "clean",
        shareableMetaChips: [
            "published",
            "v8",
            "Owner team://analytics",
            "Certified",
            "Can Export",
        ],
        reopenSourceResolutionChips: [
            "Published snapshot published_snapshot_capacity_q3 • capacityQ3",
        ],
    },
    isSavedReportPayload: true,
}), {
    level: "info",
    templateLabel: "",
    templateConflictLabel: "",
    templateConflictMessage: "",
    reuseHint: "",
    metaChips: [
        "clean",
        "published",
        "v8",
        "Owner team://analytics",
        "Certified",
        "Can Export",
        "Published snapshot published_snapshot_capacity_q3 • capacityQ3",
    ],
});

assert.deepEqual(buildReportBuilderActiveSavedArtifactNoticeState({
    summary: {
        templateConflict: true,
        compileStatus: "clean",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        blockCount: 1,
        datasetCount: 1,
    },
    kindLabel: "saved-view artifact",
    isSavedReportPayload: false,
}), {
    level: "warning",
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "",
    reuseHint: "",
    metaChips: [
        "clean",
        "Market Brief",
        "template mismatch",
        "saved-view artifact",
        "1 block",
        "1 dataset",
    ],
});

assert.deepEqual(buildReportBuilderReopenedSessionNoticeState({
    session: {
        reportId: "capacityTrendQ3",
        documentVersion: 6,
        templateLabel: "Capacity Inventory Brief",
        savedViewOverlayBaseSource: {
            kind: "reportBuilder.savedReportPayload",
            sourceArtifactId: "capacity_q3_inventory_ladder",
            reportId: "capacityTrendQ3",
        },
        savedViewOverlayPublishedSnapshotSource: {
            kind: "reportBuilder.publishedSnapshot",
            sourceArtifactId: "published_snapshot_capacity_q3",
            reportId: "capacityTrendQ3",
        },
        reopenedCompileState: {
            status: "clean",
        },
    },
    exportRequestSummary: {
        templateLabel: "Market Brief",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Reopened export request template Market Brief does not match the local saved payload template Capacity Inventory Brief.",
    },
}), {
    level: "warning",
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Reopened export request template Market Brief does not match the local saved payload template Capacity Inventory Brief.",
    reopenSourceResolutionTitle: "Resolved Reopen Sources",
    reopenSourceResolutionText: "Resolved reopen against the published snapshot and base report file.",
    reopenSourceResolutionChips: [
        "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
        "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
    ],
    reopenSourceResolutionSources: [
        {
            id: "publishedSnapshot",
            label: "Published snapshot",
            value: "published_snapshot_capacity_q3 • capacityTrendQ3",
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacity_q3",
                reportId: "capacityTrendQ3",
            },
        },
        {
            id: "baseReport",
            label: "Base report file",
            value: "capacity_q3_inventory_ladder • capacityTrendQ3",
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_inventory_ladder",
                reportId: "capacityTrendQ3",
            },
        },
    ],
    metaChips: [
        "capacityTrendQ3",
        "v6",
        "clean",
        "Market Brief",
        "template mismatch",
        "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
        "Base report file capacity_q3_inventory_ladder • capacityTrendQ3",
    ],
});

assert.deepEqual(buildReportBuilderReopenedSessionNoticeState({
    session: {
        reportId: "capacityTrendQ3",
        documentVersion: 6,
        artifactId: "shared_view_capacity_trend",
        artifactKind: "reportBuilder.savedView",
        artifactRef: "reportBuilder.savedView://shared_view_capacity_trend",
        lifecycle: "draft",
        ownerRef: "team://analytics",
        policyRef: "policy://reports/shared",
        shareableVersion: 4,
        savedSource: {
            kind: "reportBuilder.savedView",
            sourceArtifactId: "saved_view_capacity_trend",
            reportId: "capacityTrendQ3",
        },
        badges: [
            { id: "reviewed", label: "Reviewed", tone: "success" },
        ],
        capabilities: {
            share: true,
            publish: true,
        },
        grants: [
            { principalRef: "team://finance", role: "viewer" },
        ],
        reopenedCompileState: {
            status: "clean",
        },
    },
}), {
    level: "info",
    templateLabel: "",
    templateConflictLabel: "",
    templateConflictMessage: "",
    metaChips: [
        "capacityTrendQ3",
        "v6",
        "clean",
        "draft",
        "shared_view_capacity_trend",
        "saved_view_capacity_trend",
    ],
    artifactId: "shared_view_capacity_trend",
    artifactKind: "reportBuilder.savedView",
    artifactRef: "reportBuilder.savedView://shared_view_capacity_trend",
    lifecycle: "draft",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/shared",
    shareableVersion: 4,
    badges: [
        { id: "reviewed", label: "Reviewed", tone: "success" },
    ],
    capabilities: {
        share: true,
        publish: true,
    },
    grants: [
        { principalRef: "team://finance", role: "viewer" },
    ],
});

assert.deepEqual(buildReportBuilderDraftExportMetaChips({
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), ["Market Brief", "template mismatch"]);

assert.deepEqual(buildReportBuilderDraftExportMetaChips({
    templateIdentity: {
        templateLabel: "Market Brief",
    },
    templateConflictState: {
        templateConflictLabel: "template mismatch",
    },
}), ["Market Brief", "template mismatch"]);

assert.deepEqual(buildReportBuilderDraftExportMetaChips({
    document: {
        version: 1,
        kind: "reportDocument",
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [
            {
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_inventory_brief",
                    reportDocumentTemplateLabel: "Capacity Inventory Brief",
                },
            },
        ],
    },
}), ["Market Brief", "template mismatch"]);

assert.deepEqual(buildReportBuilderDraftExportNoticeState({
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Draft report template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
    },
}), {
    tone: "warning",
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Draft report template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
    metaChips: ["Market Brief", "template mismatch"],
});

assert.deepEqual(buildReportBuilderDraftExportActionState({
    requestSummary: { title: "Capacity Trend Q3" },
    requestOpen: false,
    submitting: true,
    reportExportHandlerAvailable: true,
}), {
    submitLabel: "Export PDF",
    submitDisabled: true,
    inspectLabel: "Inspect export",
});

assert.deepEqual(buildReportBuilderDraftExportRequestPanelState({
    requestInspector: {
        from: "draft",
        format: "pdf",
        artifactRef: "dashboard.reportBuilder://demo",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        hasReportPrint: true,
        content: "{\"draft\":true}",
    },
    requestOpen: true,
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), {
    metaChips: [
        "draft",
        "pdf",
        "dashboard.reportBuilder://demo",
        "Market Brief",
        "template mismatch",
        "reportPrint",
        "Market Brief",
        "template mismatch",
    ],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    content: "{\"draft\":true}",
});

assert.deepEqual(buildReportBuilderDraftExportJobPanelState({
    jobSummary: {
        jobId: "job-draft",
        status: "queued",
        artifactId: "",
        canRefresh: true,
        hasArtifact: false,
        hasFailure: false,
        error: "",
    },
    requestSummary: {
        title: "Capacity Trend Q3",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), {
    tone: "info",
    label: "Draft export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: ["job-draft", "queued", "Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: false,
    downloadLabel: "Download artifact",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderDraftExportFailureNotice({
    job: {
        hasFailure: true,
        jobId: "job-draft-fail",
        status: "failed",
        artifactId: "",
        error: "",
        diagnostics: [
            {
                code: "export.renderUnsupported",
                severity: "error",
                path: "$.reportPrint.pages[0]",
                message: "Unsupported chart primitive in current renderer.",
                suggestedFix: "Use a print-safe chart preset.",
            },
        ],
    },
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), {
    title: "Draft export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: ["Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
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

assert.deepEqual(buildReportBuilderReopenedExportMetaChips({
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    session: {
        templateLabel: "Capacity Inventory Brief",
        savedViewOverlayPublishedSnapshotSource: {
            kind: "reportBuilder.publishedSnapshot",
            sourceArtifactId: "published_snapshot_capacity_q3",
            reportId: "capacityTrendQ3",
        },
    },
}), [
    "Market Brief",
    "template mismatch",
    "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
]);

assert.deepEqual(buildReportBuilderReopenedExportMetaChips({
    requestSummary: null,
    session: {
        templateLabel: "Capacity Inventory Brief",
    },
}), ["Capacity Inventory Brief"]);

assert.deepEqual(buildReportBuilderReopenedExportMetaChips({
    requestSummary: {
        shareableMetaChips: ["published", "Certified"],
    },
    session: null,
}), ["published", "Certified"]);

assert.deepEqual(buildReportBuilderReopenedExportActionState({
    requestSummary: { title: "Capacity Trend Q3" },
    requestOpen: true,
    submitting: false,
    reportExportHandlerAvailable: false,
}), {
    submitLabel: "Review export",
    submitDisabled: false,
    inspectLabel: "Hide export",
});

assert.deepEqual(buildReportBuilderReopenedExportRequestPanelState({
    requestInspector: {
        from: "savedPayload",
        format: "pdf",
        artifactRef: "report://doc_789",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        content: "{\"reopened\":true}",
    },
    requestOpen: true,
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    session: {
        templateLabel: "Capacity Inventory Brief",
    },
}), {
    metaChips: [
        "savedPayload",
        "pdf",
        "report://doc_789",
        "Market Brief",
        "template mismatch",
        "Market Brief",
        "template mismatch",
    ],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    content: "{\"reopened\":true}",
});

assert.deepEqual(buildReportBuilderReopenedExportJobPanelState({
    jobSummary: {
        jobId: "job-5",
        status: "queued",
        artifactId: "",
        canRefresh: true,
        hasArtifact: false,
        hasFailure: false,
        error: "",
    },
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    session: {
        title: "Capacity Trend Q3",
        templateLabel: "Capacity Inventory Brief",
    },
}), {
    tone: "info",
    label: "Reopened export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: ["job-5", "queued", "Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: false,
    downloadLabel: "Download artifact",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderReopenedExportFailureNotice({
    job: {
        hasFailure: true,
        jobId: "job-6",
        status: "failed",
        artifactId: "",
        error: "",
        diagnostics: [
            {
                code: "export.renderUnsupported",
                severity: "error",
                path: "$.reportPrint.pages[0]",
                message: "Unsupported chart primitive in current renderer.",
                suggestedFix: "Use a print-safe chart preset.",
            },
        ],
    },
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    session: {
        templateLabel: "Capacity Inventory Brief",
    },
}), {
    title: "Reopened export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: ["Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
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

assert.deepEqual(buildReportBuilderSavedPayloadExportMetaChips({
    summary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), ["Market Brief", "template mismatch"]);

assert.deepEqual(buildReportBuilderSavedPayloadExportMetaChips({
    summary: {
        templateLabel: "Market Brief",
        shareableMetaChips: ["published", "Owner team://analytics"],
    },
}), ["Market Brief", "published", "Owner team://analytics"]);

assert.deepEqual(buildReportBuilderSavedPayloadExportMetaChips({
    summary: {
        templateLabel: "Market Brief",
        reopenSourceResolutionChips: ["Base report file capacity_q3_base • capacityQ3"],
    },
}), ["Market Brief", "Base report file capacity_q3_base • capacityQ3"]);

assert.deepEqual(buildReportBuilderSavedPayloadExportActionState({
    requestSummary: { title: "Capacity Trend Q3" },
    requestOpen: false,
    submitting: false,
    reportExportHandlerAvailable: true,
}), {
    submitLabel: "Export snapshot",
    submitDisabled: false,
    inspectLabel: "Inspect export",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportMetaChips({
    entrySummary: {
        backingState: "saved",
        backingSource: "catalog",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    artifactKindLabel: "published snapshot",
}), [
    "saved",
    "catalog",
    "published snapshot",
    "Market Brief",
    "template mismatch",
]);

assert.deepEqual(buildReportBuilderSelectedListEntryExportMetaChips({
    entrySummary: {
        backingState: "saved",
        backingSource: "catalog",
        reopenSourceResolutionChips: ["Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3"],
        savedViewOverlayChips: ["1 filter", "table view", "Base v9"],
    },
    artifactKindLabel: "saved view",
}), [
    "saved",
    "catalog",
    "saved view",
    "Published snapshot published_snapshot_capacity_q3 • capacityTrendQ3",
    "1 filter",
    "table view",
    "Base v9",
]);

assert.deepEqual(buildReportBuilderSelectedListEntryExportMetaChips({
    entrySummary: {
        backingState: "saved",
        backingSource: "catalog",
        shareableMetaChips: ["published", "Certified"],
    },
    artifactKindLabel: "published snapshot",
}), [
    "saved",
    "catalog",
    "published snapshot",
    "published",
    "Certified",
]);

assert.deepEqual(buildReportBuilderSelectedListEntryExportLabels({
    requestSummary: {
        artifactKindLabel: "published snapshot",
    },
    entrySummary: {
        backingSource: "catalog",
    },
}), {
    handlerLabel: "Export published snapshot",
    reviewLabel: "Review published snapshot export",
    inspectLabel: "Inspect published snapshot export",
    hideLabel: "Hide published snapshot export",
    jobLabel: "Published snapshot export",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportActionState({
    requestSummary: {
        title: "Capacity Trend Q3",
        artifactKindLabel: "published snapshot",
    },
    requestOpen: true,
    submitting: false,
    reportExportHandlerAvailable: false,
    entrySummary: {
        backingSource: "catalog",
    },
}), {
    submitLabel: "Review published snapshot export",
    submitDisabled: false,
    inspectLabel: "Hide published snapshot export",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportActionState({
    requestSummary: null,
    requestOpen: false,
    submitting: false,
    reportExportHandlerAvailable: true,
    entrySummary: {
        title: "Capacity Shared",
        localBackingAvailability: "ambiguous",
        localBackingLabel: "ambiguous local backing",
    },
}), {
    submitLabel: "Export unavailable",
    submitDisabled: true,
    inspectLabel: "Why export is unavailable",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportActionState({
    requestSummary: null,
    requestOpen: false,
    submitting: false,
    reportExportHandlerAvailable: true,
    entrySummary: {
        title: "Capacity External",
        localBackingAvailability: "missing",
        localBackingLabel: "no local backing",
    },
}), {
    submitLabel: "Export unavailable",
    submitDisabled: true,
    inspectLabel: "Why export is unavailable",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportActionState({
    requestSummary: null,
    requestOpen: false,
    submitting: false,
    reportExportHandlerAvailable: true,
    entrySummary: {
        title: "Capacity Imported",
        reopenable: true,
        backingState: "reopen-ready",
        backingSource: "imported saved-view",
        backingArtifactKindLabel: "saved-view artifact",
    },
}), {
    submitLabel: "Export unavailable",
    submitDisabled: true,
    inspectLabel: "Why export is unavailable",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportRequestPanelState({
    requestInspector: null,
    requestOpen: true,
    requestSummary: null,
    entrySummary: {
        title: "Capacity Imported",
        reopenable: true,
        backingState: "reopen-ready",
        backingSource: "imported saved-view",
        backingArtifactKindLabel: "saved-view artifact",
    },
}), {
    metaChips: [
        "reopen-ready",
        "imported saved-view",
        "saved-view artifact",
    ],
    hideLabel: "Hide export blocker",
    headerSubtitle: "Capacity Imported",
    headerDescription: "A local reopen artifact is available for this catalog entry, but no local export-ready artifact is available yet. Save or prepare a matching export-ready artifact first.",
    content: "A local reopen artifact is available for this catalog entry, but no local export-ready artifact is available yet. Save or prepare a matching export-ready artifact first.",
});

assert.deepEqual(buildReportBuilderSavedPayloadExportRequestPanelState({
    requestInspector: {
        from: "savedPayload",
        format: "pdf",
        artifactRef: "report://doc_123",
        documentVersion: 7,
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        content: "{\"ok\":true}",
    },
    requestOpen: true,
    summary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), {
    metaChips: [
        "savedPayload",
        "pdf",
        "report://doc_123",
        "v7",
        "Market Brief",
        "template mismatch",
        "Market Brief",
        "template mismatch",
    ],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    content: "{\"ok\":true}",
});

assert.deepEqual(buildReportBuilderSavedPayloadExportJobPanelState({
    jobSummary: {
        jobId: "job-1",
        status: "queued",
        artifactId: "",
        canRefresh: true,
        hasArtifact: false,
        hasFailure: false,
        error: "",
    },
    summary: {
        title: "Capacity Q3",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    requestSummary: {
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Date Range",
        scopeSummaryItems: [{ id: "dateRange", label: "Date Range" }],
    },
}), {
    tone: "info",
    label: "Saved export",
    title: "Capacity Q3",
    error: "",
    metaChips: ["job-1", "queued", "Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Date Range",
    scopeSummaryItems: [{ id: "dateRange", label: "Date Range" }],
    refreshLabel: "Refresh status",
    refreshDisabled: false,
    downloadLabel: "Download artifact",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderSavedPayloadRecentExportEntries({
    jobs: [
        {
            jobId: "job-1",
            status: "queued",
            artifactId: "",
            artifactRef: "report://doc_123",
            format: "pdf",
            submittedAt: "2026-06-13T11:30:00Z",
        },
        {
            jobId: "job-2",
            status: "succeeded",
            artifactId: "artifact-2",
            artifactRef: "report://doc_123",
            format: "xlsx",
            submittedAt: "2026-06-13T11:00:00Z",
            completedAt: "2026-06-13T11:05:00Z",
        },
    ],
    artifacts: [
        {
            artifactId: "artifact-2",
            artifactRef: "report://doc_123",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            format: "xlsx",
            createdAt: "2026-06-13T11:00:00Z",
            retentionTtlMs: 7200000,
        },
    ],
    summary: {
        title: "Capacity Q3",
        templateLabel: "Market Brief",
        reopenSourceResolutionChips: [
            "Base report file capacity_q3_base • capacityQ3",
        ],
    },
    activeJobId: "job-2",
    nowMs: Date.parse("2026-06-13T12:00:00Z"),
}), [
    {
        id: "recentExport:job-1",
        label: "Recent export",
        title: "Capacity Q3",
        subtitle: "PDF • queued",
        description: "Export job-1 is queued.",
        metaChips: ["job-1", "pdf", "submitted 30m ago", "Market Brief", "Base report file capacity_q3_base • capacityQ3"],
        notice: null,
        reviewLabel: "Use current",
        downloadLabel: "",
        hasArtifact: false,
        canRefresh: true,
        active: false,
        job: {
            jobId: "job-1",
            status: "queued",
            artifactId: "",
            artifactRef: "report://doc_123",
            format: "pdf",
            submittedAt: "2026-06-13T11:30:00Z",
        },
        artifact: null,
    },
    {
        id: "recentExport:job-2",
        label: "Completed export",
        title: "Capacity Q3",
        subtitle: "XLSX • succeeded",
        description: "Artifact artifact-2 is available for download.",
        metaChips: ["job-2", "artifact-2", "xlsx", "submitted 1h ago", "expires in 1h", "Market Brief", "Base report file capacity_q3_base • capacityQ3"],
        notice: {
            level: "info",
            message: "Current export selection",
        },
        reviewLabel: "Use current",
        downloadLabel: "Download artifact",
        hasArtifact: true,
        canRefresh: false,
        active: true,
        job: {
            jobId: "job-2",
            status: "succeeded",
            artifactId: "artifact-2",
            artifactRef: "report://doc_123",
            format: "xlsx",
            submittedAt: "2026-06-13T11:00:00Z",
            completedAt: "2026-06-13T11:05:00Z",
        },
        artifact: {
            artifactId: "artifact-2",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            artifactRef: "report://doc_123",
            format: "xlsx",
            createdAt: "2026-06-13T11:00:00Z",
            retentionTtlMs: 7200000,
        },
    },
]);

assert.deepEqual(buildReportBuilderSavedPayloadRecentExportEntries({
    jobs: [
        {
            jobId: "job-expired",
            status: "succeeded",
            artifactId: "artifact-expired",
            artifactRef: "report://doc_123",
            format: "pdf",
            submittedAt: "2026-06-13T09:00:00Z",
            completedAt: "2026-06-13T09:05:00Z",
        },
    ],
    artifacts: [
        {
            artifactId: "artifact-expired",
            jobId: "job-expired",
            artifactRef: "report://doc_123",
            contentType: "application/pdf",
            format: "pdf",
            createdAt: "2026-06-13T09:00:00Z",
            retentionTtlMs: 3600000,
        },
    ],
    summary: {
        title: "Capacity Q3",
        reopenSourceResolutionChips: [
            "Base report file capacity_q3_base • capacityQ3",
        ],
    },
    nowMs: Date.parse("2026-06-13T12:00:00Z"),
}), [
    {
        id: "recentExport:job-expired",
        label: "Recent export",
        title: "Capacity Q3",
        subtitle: "PDF • succeeded",
        description: "Artifact artifact-expired has expired and is no longer downloadable.",
        metaChips: ["job-expired", "artifact-expired", "pdf", "submitted 3h ago", "expired", "Base report file capacity_q3_base • capacityQ3"],
        notice: null,
        reviewLabel: "Use current",
        downloadLabel: "",
        hasArtifact: false,
        canRefresh: false,
        active: false,
        job: {
            jobId: "job-expired",
            status: "succeeded",
            artifactId: "",
            artifactRef: "report://doc_123",
            format: "pdf",
            submittedAt: "2026-06-13T09:00:00Z",
            completedAt: "2026-06-13T09:05:00Z",
        },
        artifact: null,
    },
]);

assert.deepEqual(buildReportBuilderSavedPayloadExportFailureNotice({
    job: {
        hasFailure: true,
        jobId: "job-2",
        status: "failed",
        artifactId: "",
        error: "Export failed",
        diagnostics: [
            {
                code: "export.renderUnsupported",
                severity: "error",
                path: "$.reportPrint.pages[0]",
                message: "Unsupported chart primitive in current renderer.",
                suggestedFix: "Use a print-safe chart preset.",
            },
        ],
    },
    summary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    requestSummary: {
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), {
    title: "Saved export failed",
    description: "Export failed",
    metaChips: ["Market Brief", "template mismatch"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
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

assert.deepEqual(buildReportBuilderSelectedListEntryExportRequestPanelState({
    requestInspector: {
        from: "selected",
        format: "pdf",
        artifactRef: "report://doc_456",
        documentVersion: 5,
        templateLabel: "Market Brief",
        content: "{\"entry\":true}",
    },
    requestOpen: true,
    requestSummary: {
        artifactKindLabel: "published snapshot",
    },
    entrySummary: {
        backingState: "saved",
        backingSource: "catalog",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), {
    metaChips: [
        "selected",
        "pdf",
        "report://doc_456",
        "v5",
        "Market Brief",
        "saved",
        "catalog",
        "published snapshot",
        "Market Brief",
        "template mismatch",
    ],
    hideLabel: "Hide published snapshot export",
    downloadLabel: "Download export request",
    content: "{\"entry\":true}",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportRequestPanelState({
    requestInspector: null,
    requestOpen: true,
    requestSummary: null,
    entrySummary: {
        title: "Capacity Shared",
        localBackingAvailability: "ambiguous",
        localBackingLabel: "ambiguous local backing",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [{ id: "dateRange", label: "Reporting Window" }],
    },
}), {
    metaChips: [
        "ambiguous local backing",
    ],
    hideLabel: "Hide export blocker",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [{ id: "dateRange", label: "Reporting Window" }],
    headerSubtitle: "Capacity Shared",
    headerDescription: "Multiple local artifacts match this report id. Explicit source identity is required before a selected-entry export request can be prepared.",
    content: "Multiple local artifacts match this report id. Explicit source identity is required before a selected-entry export request can be prepared.",
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportJobPanelState({
    jobSummary: {
        jobId: "job-3",
        status: "succeeded",
        artifactId: "artifact-1",
        canRefresh: false,
        hasArtifact: true,
        hasFailure: false,
        error: "",
    },
    requestSummary: {
        artifactKindLabel: "published snapshot",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    entrySummary: {
        title: "Capacity Q3",
        backingState: "saved",
        backingSource: "catalog",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), {
    tone: "info",
    label: "Published snapshot export",
    title: "Capacity Q3",
    error: "",
    metaChips: [
        "job-3",
        "succeeded",
        "artifact-1",
        "saved",
        "catalog",
        "published snapshot",
        "Market Brief",
        "template mismatch",
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: true,
    downloadLabel: "Download artifact",
    downloadDisabled: false,
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportJobPanelState({
    jobSummary: null,
    requestSummary: null,
    entrySummary: {
        title: "Capacity Shared",
        localBackingAvailability: "ambiguous",
        localBackingLabel: "ambiguous local backing",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), {
    tone: "warning",
    label: "Selected export",
    title: "Capacity Shared",
    error: "Multiple local artifacts match this report id. Explicit source identity is required before a selected-entry export request can be prepared.",
    metaChips: [
        "ambiguous local backing",
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: true,
    downloadLabel: "Download artifact",
    downloadDisabled: true,
});

assert.deepEqual(buildReportBuilderSelectedListEntryExportFailureNotice({
    job: {
        hasFailure: true,
        jobId: "job-4",
        status: "failed",
        artifactId: "",
        error: "",
        diagnostics: [
            {
                code: "export.renderUnsupported",
                severity: "error",
                path: "$.reportPrint.pages[0]",
                message: "Unsupported chart primitive in current renderer.",
                suggestedFix: "Use a print-safe chart preset.",
            },
        ],
    },
    requestSummary: {
        artifactKindLabel: "published snapshot",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    entrySummary: {
        backingState: "saved",
        backingSource: "catalog",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
}), {
    title: "Published snapshot export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: [
        "saved",
        "catalog",
        "published snapshot",
        "Market Brief",
        "template mismatch",
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
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

assert.deepEqual(buildReportBuilderReopenedExportNoticeState({
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Reopened export request template Market Brief does not match the local saved payload template Capacity Inventory Brief.",
    },
    session: {
        templateLabel: "Capacity Inventory Brief",
    },
}), {
    tone: "warning",
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Reopened export request template Market Brief does not match the local saved payload template Capacity Inventory Brief.",
    metaChips: ["Market Brief", "template mismatch"],
});

console.log("reportBuilderSavedArtifactViewState ✓ exposes user-facing save/load labels without changing artifact semantics");
