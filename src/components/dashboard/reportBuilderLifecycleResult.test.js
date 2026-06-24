import assert from "node:assert/strict";

import { buildReportBuilderReportSpec } from "../../reporting/reportSpecModel.js";
import { buildReportFillFromReportSpec } from "../../reporting/reportFillModel.js";
import { buildReportPrintFromReportFill } from "../../reporting/reportPrintModel.js";
import {
    applyReportBuilderLifecycleSharedArtifactToListResponse,
    buildReportBuilderLifecycleSharedArtifactDownload,
    buildReportBuilderLifecycleSharedArtifactInspectorState,
    buildReportBuilderLifecycleSharedArtifactPayload,
    buildReportBuilderLifecycleSharedArtifactSummary,
    normalizeReportBuilderLifecycleSharedArtifactRecord,
    resolveReportBuilderLifecycleResultEnvelope,
    serializeReportBuilderLifecycleSharedArtifact,
    upsertReportBuilderLifecycleSharedArtifactRecord,
} from "./reportBuilderLifecycleResult.js";

const savedViewResult = {
    version: 1,
    kind: "reportBuilder.savedView",
    id: "saved_view_capacity_q3",
    title: "Capacity Q3 Saved View",
    reportId: "capacityQ3",
    documentVersion: 8,
    savedAt: 9400,
    lifecycle: "published",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/certified",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityQ3",
        title: "Capacity Q3 Saved View",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    reportFill: {
        version: 1,
        kind: "reportFill",
        datasets: [{ id: "primary", rows: [] }],
    },
    reportPrint: {
        version: 1,
        kind: "reportPrint",
        title: "Capacity Q3 Saved View",
    },
    savedViewOverlay: {
        overlay: {
            presentation: {
                viewMode: "table",
            },
        },
    },
};

const normalizedSavedViewRecord = normalizeReportBuilderLifecycleSharedArtifactRecord(savedViewResult);
assert.equal(normalizedSavedViewRecord?.source?.kind, "reportBuilder.savedView");
assert.equal(normalizedSavedViewRecord?.source?.sourceArtifactId, "saved_view_capacity_q3");
assert.equal(normalizedSavedViewRecord?.exportable, false);
assert.equal(normalizedSavedViewRecord?.exportRequest, undefined);
assert.equal(normalizedSavedViewRecord?.savedViewOverlay?.overlay?.presentation?.viewMode, "table");
assert.equal(normalizedSavedViewRecord?.ownerRef, "team://analytics");

const thinPublishedSnapshotRecord = normalizeReportBuilderLifecycleSharedArtifactRecord({
    version: 1,
    kind: "reportBuilder.publishedSnapshot",
    id: "published_snapshot_capacity_q3",
    title: "Capacity Q3 Published Snapshot",
    reportId: "capacityQ3",
    documentVersion: 9,
    savedAt: 9500,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityQ3",
        title: "Capacity Q3 Published Snapshot",
    },
});
assert.equal(thinPublishedSnapshotRecord?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(thinPublishedSnapshotRecord?.exportable, false);
assert.equal(thinPublishedSnapshotRecord?.exportRequest, undefined);

const exportableSpec = buildReportBuilderReportSpec({
    container: {
        id: "capacityBuilder",
        stateKey: "capacityState",
        title: "Capacity Q3 Saved View",
        dataSourceRef: "capacityCube",
    },
    config: {
        title: "Capacity Q3 Saved View",
        measures: [
            { id: "spend", key: "spend", label: "Spend", paramPath: "measures.spend", default: true, format: "currency" },
        ],
        dimensions: [
            { id: "channel", key: "channel", label: "Channel", paramPath: "dimensions.channel", default: true },
        ],
        result: {
            defaultMode: "table",
            chartCreationMode: "explicit",
            pageSize: 25,
        },
    },
    state: {
        selectedMeasures: ["spend"],
        primaryMeasure: "spend",
        selectedDimensions: ["channel"],
        viewMode: "table",
        pageSize: 25,
        orderField: "channel",
        orderDir: "asc",
    },
});
const exportableFill = buildReportFillFromReportSpec(exportableSpec, {
    primary: {
        rows: [
            { channel: "CTV", spend: 12345 },
        ],
    },
});
const exportablePrint = buildReportPrintFromReportFill({
    reportSpec: exportableSpec,
    reportFill: exportableFill,
});
const exportableSavedViewRecord = normalizeReportBuilderLifecycleSharedArtifactRecord({
    ...savedViewResult,
    reportSpec: exportableSpec,
    reportFill: exportableFill,
    reportPrint: exportablePrint,
});
assert.equal(exportableSavedViewRecord?.exportable, true);
assert.equal(exportableSavedViewRecord?.exportRequest?.source?.from, "savedView");
assert.equal(buildReportBuilderLifecycleSharedArtifactPayload(exportableSavedViewRecord)?.kind, "reportBuilder.savedView");
assert.equal(buildReportBuilderLifecycleSharedArtifactSummary(exportableSavedViewRecord)?.title, "Capacity Q3 Saved View");
assert.match(
    serializeReportBuilderLifecycleSharedArtifact(exportableSavedViewRecord),
    /"kind": "reportBuilder\.savedView"/,
);
assert.equal(
    buildReportBuilderLifecycleSharedArtifactInspectorState(exportableSavedViewRecord)?.content.includes('"reportPrint"'),
    true,
);
assert.equal(
    buildReportBuilderLifecycleSharedArtifactDownload(exportableSavedViewRecord)?.filename,
    "Capacity Q3 Saved View-saved-view.json",
);

const lifecycleEnvelope = {
    message: "Shared saved view created.",
    sharedArtifact: {
        ...savedViewResult,
        reportSpec: undefined,
        reportFill: undefined,
        reportPrint: undefined,
    },
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityQ3" },
        documentVersion: 8,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3 Saved View",
        },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityQ3",
            sourceArtifactId: "saved_view_capacity_q3",
        },
    },
    listReportDocumentsResponse: {
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [
            {
                reportRef: { reportId: "capacityQ3" },
                title: "Capacity Q3 Saved View",
                documentVersion: 8,
                source: {
                    kind: "reportBuilder.savedView",
                    reportId: "capacityQ3",
                    sourceArtifactId: "saved_view_capacity_q3",
                },
            },
        ],
        cursor: "",
        hasMore: false,
    },
    exportRequest: exportableSavedViewRecord.exportRequest,
};
const resolvedEnvelope = resolveReportBuilderLifecycleResultEnvelope(lifecycleEnvelope);
assert.equal(resolvedEnvelope.message, "Shared saved view created.");
assert.equal(resolvedEnvelope.sharedArtifact?.kind, "reportBuilder.savedView");
assert.equal(resolvedEnvelope.getReportDocumentResponse?.kind, "getReportDocumentResponse");
assert.equal(resolvedEnvelope.listReportDocumentsResponse?.kind, "listReportDocumentsResponse");
assert.equal(resolvedEnvelope.exportRequest?.source?.from, "savedView");
assert.equal(
    normalizeReportBuilderLifecycleSharedArtifactRecord(lifecycleEnvelope)?.exportable,
    true,
);

const preparedArtifactsEnvelope = resolveReportBuilderLifecycleResultEnvelope({
    message: "Prepared reopen artifacts.",
    getReportDocumentRequest: {
        version: 1,
        kind: "getReportDocumentRequest",
        reportRef: {
            reportId: "capacityQ3",
        },
    },
    reopenReportDocumentDiagnostic: {
        version: 1,
        kind: "reportBuilder.reopenDiagnostic",
        code: "incompatibleSource",
        severity: "error",
        title: "Capacity Q3",
        message: "This ReportDocument targets a different builder source.",
    },
});
assert.equal(preparedArtifactsEnvelope.message, "Prepared reopen artifacts.");
assert.equal(preparedArtifactsEnvelope.getReportDocumentRequest?.kind, "getReportDocumentRequest");
assert.equal(preparedArtifactsEnvelope.getReportDocumentRequest?.reportRef?.reportId, "capacityQ3");
assert.equal(preparedArtifactsEnvelope.reopenReportDocumentDiagnostic?.kind, "reportBuilder.reopenDiagnostic");
assert.equal(preparedArtifactsEnvelope.reopenReportDocumentDiagnostic?.code, "incompatibleSource");

const preparedMutationEnvelope = resolveReportBuilderLifecycleResultEnvelope({
    message: "Prepared create and update artifacts.",
    createReportDocumentPayload: {
        version: 1,
        kind: "createReportDocumentPayload",
        reportRef: { reportId: "capacityQ3" },
        title: "Capacity Q3",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3",
        },
        compileState: {
            status: "clean",
            blockCount: 1,
            datasetCount: 1,
        },
    },
    updateReportDocumentPayload: {
        version: 1,
        kind: "updateReportDocumentPayload",
        reportRef: { reportId: "capacityQ3" },
        expectedVersion: 8,
        title: "Capacity Q3",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3",
        },
        compileState: {
            status: "clean",
            blockCount: 1,
            datasetCount: 1,
        },
    },
    updateReportDocumentConflictDiagnostic: {
        version: 1,
        kind: "updateReportDocumentConflictDiagnostic",
        reportRef: { reportId: "capacityQ3" },
        title: "Capacity Q3",
        code: "reportDocumentVersionConflict",
        severity: "error",
        expectedVersion: 8,
        currentVersion: 9,
        message: "Could not update Capacity Q3 because expected version 8 does not match current saved version 9.",
    },
});
assert.equal(preparedMutationEnvelope.createReportDocumentPayload?.kind, "createReportDocumentPayload");
assert.equal(preparedMutationEnvelope.createReportDocumentPayload?.reportRef?.reportId, "capacityQ3");
assert.equal(preparedMutationEnvelope.updateReportDocumentPayload?.kind, "updateReportDocumentPayload");
assert.equal(preparedMutationEnvelope.updateReportDocumentPayload?.expectedVersion, 8);
assert.equal(preparedMutationEnvelope.updateReportDocumentConflictDiagnostic?.kind, "updateReportDocumentConflictDiagnostic");
assert.equal(preparedMutationEnvelope.updateReportDocumentConflictDiagnostic?.currentVersion, 9);

const nestedSharedArtifactEnvelope = resolveReportBuilderLifecycleResultEnvelope({
    result: {
        sharedArtifact: savedViewResult,
    },
});
assert.equal(nestedSharedArtifactEnvelope.sharedArtifact?.kind, "reportBuilder.savedView");
assert.equal(nestedSharedArtifactEnvelope.sharedArtifact?.id, "saved_view_capacity_q3");

const upsertedRecords = upsertReportBuilderLifecycleSharedArtifactRecord([
    {
        reportId: "capacityQ3",
        title: "Older Shared View",
        documentVersion: 7,
        savedAt: 9300,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Older Shared View",
        },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityQ3",
            sourceArtifactId: "saved_view_capacity_q3",
        },
    },
], savedViewResult);
assert.equal(upsertedRecords.length, 1);
assert.equal(upsertedRecords[0].title, "Capacity Q3 Saved View");
assert.equal(upsertedRecords[0].documentVersion, 8);

const patchedListResponse = applyReportBuilderLifecycleSharedArtifactToListResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityQ3" },
            title: "Capacity Q3 Draft",
            documentVersion: 7,
            source: {
                kind: "reportBuilder.savedReportPayload",
                reportId: "capacityQ3",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, savedViewResult, {
    targetSource: {
        kind: "reportBuilder.savedReportPayload",
        reportId: "capacityQ3",
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3",
    },
});
assert.equal(patchedListResponse?.entries?.length, 1);
assert.equal(patchedListResponse?.entries?.[0]?.title, "Capacity Q3 Saved View");
assert.equal(patchedListResponse?.entries?.[0]?.documentVersion, 8);
assert.equal(patchedListResponse?.entries?.[0]?.source?.kind, "reportBuilder.savedView");
assert.equal(patchedListResponse?.entries?.[0]?.source?.sourceArtifactId, "saved_view_capacity_q3");

const duplicatePatchedListResponse = applyReportBuilderLifecycleSharedArtifactToListResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityQ3" },
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
        },
        {
            reportRef: { reportId: "capacityQ3" },
            title: "Capacity Q3 Draft",
            documentVersion: 7,
            source: {
                kind: "reportBuilder.savedReportPayload",
                reportId: "capacityQ3",
                payloadId: "rbreport_capacity_q3",
                sourceArtifactId: "capacity_q3",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, savedViewResult, {
    targetSource: {
        kind: "reportBuilder.savedReportPayload",
        reportId: "capacityQ3",
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3",
    },
});
assert.equal(duplicatePatchedListResponse?.entries?.length, 2);
assert.equal(duplicatePatchedListResponse?.entries?.[0]?.title, "Capacity Q3 Published Snapshot");
assert.equal(duplicatePatchedListResponse?.entries?.[0]?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(duplicatePatchedListResponse?.entries?.[0]?.source?.sourceArtifactId, "published_snapshot_capacity_q3");
assert.equal(duplicatePatchedListResponse?.entries?.[1]?.title, "Capacity Q3 Saved View");
assert.equal(duplicatePatchedListResponse?.entries?.[1]?.documentVersion, 8);
assert.equal(duplicatePatchedListResponse?.entries?.[1]?.source?.kind, "reportBuilder.savedView");
assert.equal(duplicatePatchedListResponse?.entries?.[1]?.source?.sourceArtifactId, "saved_view_capacity_q3");

console.log("reportBuilderLifecycleResult ✓ normalizes returned shared artifacts into saved-record and catalog-entry contracts");
