import assert from "node:assert/strict";

import {
    projectReportBuilderLifecycleEnvelopeState,
    reconcileReportBuilderLifecycleSharedArtifactState,
    shouldReconcileReportBuilderHydratedSession,
} from "./reportBuilderLifecycleSharedArtifactReconciliation.js";
import { buildReportBuilderListReportDocumentsEntrySelectionKey } from "./reportBuilderReportDocumentReadResponse.js";

const sharedRecord = {
    kind: "reportBuilder.publishedSnapshot",
    artifactId: "published_snapshot_capacity_shared",
    artifactKind: "reportBuilder.publishedSnapshot",
    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_shared",
    lifecycle: "published",
    ownerRef: "team://capacity",
    policyRef: "policy://capacity/shared",
    shareableVersion: 9,
    reportId: "capacityShared",
    documentVersion: 9,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityShared",
        sourceArtifactId: "published_snapshot_capacity_shared",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityShared",
        title: "Capacity Shared Published Snapshot",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

assert.equal(
    shouldReconcileReportBuilderHydratedSession(
        {
            savedSource: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        },
        {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    ),
    true,
);

const reconciled = reconcileReportBuilderLifecycleSharedArtifactState({
    record: sharedRecord,
    localLifecycleSharedArtifactRecords: [],
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityShared" },
        documentVersion: 8,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityShared",
            title: "Capacity Shared Saved View",
        },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    },
    reopenReportDocumentDiagnostic: {
        version: 1,
        kind: "reportBuilder.reopenDiagnostic",
        code: "incompatibleSource",
        severity: "error",
        reportRef: { reportId: "capacityShared" },
        title: "Capacity Shared Saved View",
        documentVersion: 8,
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
        message: "This ReportDocument targets a different builder source.",
    },
    createReportDocumentPayload: {
        version: 1,
        kind: "createReportDocumentPayload",
        reportRef: { reportId: "capacityShared" },
        title: "Capacity Shared Saved View",
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    },
    updateReportDocumentPayload: {
        version: 1,
        kind: "updateReportDocumentPayload",
        reportRef: { reportId: "capacityShared" },
        expectedVersion: 8,
        title: "Capacity Shared Saved View",
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    },
    backendSharedArtifactRecords: [
        {
            reportId: "capacityShared",
            title: "Capacity Shared Saved View",
            documentVersion: 8,
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        },
    ],
    hydratedSession: {
        reportId: "capacityShared",
        title: "Capacity Shared Saved View",
        documentVersion: 8,
        savedSource: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
        reopenedConfig: {},
        liveSnapshot: {
            config: {},
            state: {},
        },
    },
    hydratedSessionTargetSource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared",
    },
    listReportDocumentsResponse: {
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [
            {
                reportRef: { reportId: "capacityShared" },
                artifactId: "saved_view_capacity_shared",
                documentVersion: 8,
                title: "Capacity Shared Saved View",
                source: {
                    kind: "reportBuilder.savedView",
                    reportId: "capacityShared",
                    sourceArtifactId: "saved_view_capacity_shared",
                },
            },
        ],
        cursor: "",
        hasMore: false,
    },
    listResponseTargetSource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared",
    },
});

assert.equal(reconciled.record?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.localLifecycleSharedArtifactRecords?.[0]?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.getReportDocumentResponse?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.reopenReportDocumentDiagnostic?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.createReportDocumentPayload?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.updateReportDocumentPayload?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.updateReportDocumentPayload?.expectedVersion, 9);
assert.equal(reconciled.clearUpdateReportDocumentConflictDiagnostic, true);
assert.equal(reconciled.backendSharedArtifactRecords?.[0]?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.hydratedSession?.savedSource?.kind, "reportBuilder.publishedSnapshot");
assert.equal(reconciled.listReportDocumentsResponse?.entries?.[0]?.source?.kind, "reportBuilder.publishedSnapshot");

const projected = projectReportBuilderLifecycleEnvelopeState({
    result: {
        message: "Published snapshot created.",
        sharedArtifact: sharedRecord,
        getReportDocumentResponse: {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: { reportId: "capacityShared" },
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityShared",
                title: "Capacity Shared Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        },
        listReportDocumentsResponse: {
            version: 1,
            kind: "listReportDocumentsResponse",
            entries: [
                {
                    reportRef: { reportId: "capacityShared" },
                    title: "Capacity Shared Saved View",
                    documentVersion: 8,
                    source: {
                        kind: "reportBuilder.savedView",
                        reportId: "capacityShared",
                        sourceArtifactId: "saved_view_capacity_shared",
                    },
                },
            ],
            cursor: "",
            hasMore: false,
        },
        updateReportDocumentPayload: {
            version: 1,
            kind: "updateReportDocumentPayload",
            reportRef: { reportId: "capacityShared" },
            expectedVersion: 8,
            title: "Capacity Shared Saved View",
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        },
    },
    localLifecycleSharedArtifactRecords: [],
    replaceSelectedListEntrySource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared",
    },
    updateReportDocumentConflictDiagnostic: {
        version: 1,
        kind: "updateReportDocumentConflictDiagnostic",
        reportRef: { reportId: "capacityShared" },
        expectedVersion: 8,
        currentVersion: 7,
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    },
});
assert.equal(projected?.record?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(projected?.getReportDocumentResponse?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(projected?.listReportDocumentsResponse?.entries?.[0]?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(projected?.updateReportDocumentPayload?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(projected?.clearUpdateReportDocumentConflictDiagnostic, true);
assert.equal(projected?.updateReportDocumentConflictDiagnostic, null);
assert.equal(
    projected?.selectedEntryKey,
    buildReportBuilderListReportDocumentsEntrySelectionKey(projected?.listReportDocumentsResponse?.entries?.[0] || null),
);
assert.equal(
    projected?.selectedReportId,
    buildReportBuilderListReportDocumentsEntrySelectionKey(projected?.listReportDocumentsResponse?.entries?.[0] || null),
);

const staleSelectedKeyProjected = projectReportBuilderLifecycleEnvelopeState({
    result: {
        selectedReportId: buildReportBuilderListReportDocumentsEntrySelectionKey({
            reportRef: { reportId: "capacityShared" },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        }),
        message: "Published snapshot created.",
        sharedArtifact: sharedRecord,
        listReportDocumentsResponse: {
            version: 1,
            kind: "listReportDocumentsResponse",
            entries: [
                {
                    reportRef: { reportId: "capacityShared" },
                    title: "Capacity Shared Saved View",
                    documentVersion: 8,
                    source: {
                        kind: "reportBuilder.savedView",
                        reportId: "capacityShared",
                        sourceArtifactId: "saved_view_capacity_shared",
                    },
                },
            ],
            cursor: "",
            hasMore: false,
        },
    },
    localLifecycleSharedArtifactRecords: [],
    replaceSelectedListEntrySource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared",
    },
});
assert.equal(
    staleSelectedKeyProjected?.selectedEntryKey,
    buildReportBuilderListReportDocumentsEntrySelectionKey(staleSelectedKeyProjected?.listReportDocumentsResponse?.entries?.[0] || null),
);
assert.equal(
    staleSelectedKeyProjected?.selectedReportId,
    buildReportBuilderListReportDocumentsEntrySelectionKey(staleSelectedKeyProjected?.listReportDocumentsResponse?.entries?.[0] || null),
);

const sharedArtifactOnlyProjected = projectReportBuilderLifecycleEnvelopeState({
    result: {
        message: "Published snapshot created.",
        sharedArtifact: sharedRecord,
    },
    localLifecycleSharedArtifactRecords: [],
});
assert.equal(
    sharedArtifactOnlyProjected?.selectedEntryKey,
    "capacityShared::reportBuilder.publishedSnapshot::::published_snapshot_capacity_shared",
);
assert.equal(
    sharedArtifactOnlyProjected?.selectedReportId,
    "capacityShared::reportBuilder.publishedSnapshot::::published_snapshot_capacity_shared",
);

console.log("reportBuilderLifecycleSharedArtifactReconciliation ✓ reconciles shared-artifact lifecycle results across prepared, reopened, and catalog surfaces");
