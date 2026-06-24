import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildHydratedReportBuilderDocument } from "./reportBuilderHydratedReportDocument.js";
import { buildReportBuilderListReportDocumentsEntrySelectionKey } from "./reportBuilderReportDocumentReadResponse.js";
import {
    buildReportBuilderRuntimePreview,
    buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";
import { buildReportBuilderDetailTargetImportedArtifactFixtureState } from "./reportBuilderDetailTargetImportedArtifactFixtureState.js";
import { parseReportBuilderLocalImport } from "./reportBuilderLocalImport.js";

const savedReportRecordFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-direct-series-saved-report-record-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const importedSavedReportRecord = parseReportBuilderLocalImport(JSON.stringify(savedReportRecordFixture), {
    fileName: "capacity-kpi-blend.saved-report-record.json",
});

assert.equal(importedSavedReportRecord.valid, true);
assert.equal(importedSavedReportRecord.kind, "reportBuilder.savedReportRecord");
assert.equal(importedSavedReportRecord.fileName, "capacity-kpi-blend.saved-report-record.json");
assert.equal(importedSavedReportRecord.title, "Capacity KPI Blend Q3");
assert.equal(importedSavedReportRecord.documentVersion, 9);
assert.equal(importedSavedReportRecord.exportable, true);
assert.equal(importedSavedReportRecord.savedRecord?.reportId, "capacityKpiBlendByDateQ3");
assert.equal(importedSavedReportRecord.savedRecord?.exportable, true);
assert.equal(importedSavedReportRecord.getReportDocumentResponse?.kind, "getReportDocumentResponse");
assert.equal(importedSavedReportRecord.getReportDocumentResponse?.reportRef?.reportId, "capacityKpiBlendByDateQ3");
assert.equal(importedSavedReportRecord.getReportDocumentResponse?.documentVersion, 9);
assert.equal(importedSavedReportRecord.getReportDocumentResponse?.reportSpec?.kind, "reportSpec");
assert.equal(importedSavedReportRecord.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.savedReportRecord");
assert.equal(importedSavedReportRecord.message, "Imported report file Capacity KPI Blend Q3. Reopen and export are ready.");

const wrappedSavedViewOverlayRecord = parseReportBuilderLocalImport(JSON.stringify({
    version: 1,
    kind: "reportBuilder.savedReportRecord",
    reportId: "capacityShared",
    title: "Capacity Shared Saved View Overlay",
    documentVersion: 10,
    savedAt: 9300,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityShared",
        title: "Capacity Shared Saved View Overlay",
    },
    source: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared_overlay",
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://capacityShared",
            reportId: "capacityShared",
            documentVersion: 9,
        },
        overlay: {
            filters: {
                dateRange: {
                    start: "2026-05-01",
                    end: "2026-05-04",
                },
            },
            presentation: {
                viewMode: "table",
            },
        },
    },
}), {
    fileName: "capacity-shared.saved-view-record.json",
});

assert.equal(wrappedSavedViewOverlayRecord.valid, true);
assert.equal(wrappedSavedViewOverlayRecord.savedRecord?.savedViewOverlay?.overlay?.presentation?.viewMode, "table");
assert.equal(wrappedSavedViewOverlayRecord.getReportDocumentResponse?.savedViewOverlay?.overlay?.filters?.dateRange?.start, "2026-05-01");

const rawReportFill = savedReportRecordFixture?.exportRequest?.reportFill;
const importedReportFill = parseReportBuilderLocalImport(JSON.stringify(rawReportFill), {
    fileName: "capacity-kpi-blend.report-fill.json",
});

assert.equal(importedReportFill.valid, true);
assert.equal(importedReportFill.kind, "reportFill");
assert.equal(importedReportFill.fileName, "capacity-kpi-blend.report-fill.json");
assert.equal(importedReportFill.title, "capacity-kpi-blend.report-fill");
assert.equal(importedReportFill.datasetCount, rawReportFill.datasets.length);
assert.equal(importedReportFill.blockCount, rawReportFill.blocks.length);
assert.equal(importedReportFill.rowCount, 8);
assert.equal(importedReportFill.diagnosticCount, (rawReportFill.diagnostics || []).length);
assert.equal(importedReportFill.message, "Imported ReportFill capacity-kpi-blend.report-fill. Inspect or download is ready.");
assert.equal(importedReportFill.payload?.kind, "reportFill");

const rawReportPrint = savedReportRecordFixture?.exportRequest?.reportPrint;
const importedReportPrint = parseReportBuilderLocalImport(JSON.stringify(rawReportPrint), {
    fileName: "capacity-kpi-blend.report-print.json",
});

assert.equal(importedReportPrint.valid, true);
assert.equal(importedReportPrint.kind, "reportPrint");
assert.equal(importedReportPrint.fileName, "capacity-kpi-blend.report-print.json");
assert.equal(importedReportPrint.title, "Capacity KPI Blend Q3");
assert.equal(importedReportPrint.pageCount, rawReportPrint.pages.length);
assert.equal(importedReportPrint.bookmarkCount, rawReportPrint.bookmarks.length);
assert.equal(importedReportPrint.pageWidth, rawReportPrint.pageGeometry.width);
assert.equal(importedReportPrint.pageHeight, rawReportPrint.pageGeometry.height);
assert.equal(importedReportPrint.message, "Imported ReportPrint Capacity KPI Blend Q3. Inspect or download is ready.");
assert.equal(importedReportPrint.payload?.kind, "reportPrint");

const audienceRawReportPrint = audienceArtifactFixture?.pdfReportPrint;
const importedAudienceReportPrint = parseReportBuilderLocalImport(JSON.stringify(audienceRawReportPrint), {
    fileName: "capacity-audience.report-print.json",
});

assert.equal(importedAudienceReportPrint.valid, true);
assert.equal(importedAudienceReportPrint.kind, "reportPrint");
assert.equal(importedAudienceReportPrint.fileName, "capacity-audience.report-print.json");
assert.equal(importedAudienceReportPrint.title, "Capacity Audience Segment Index Q3");
assert.equal(importedAudienceReportPrint.pageCount, audienceRawReportPrint.pages.length);
assert.equal(importedAudienceReportPrint.bookmarkCount, audienceRawReportPrint.bookmarks.length);
assert.equal(importedAudienceReportPrint.pageWidth, audienceRawReportPrint.pageGeometry.width);
assert.equal(importedAudienceReportPrint.pageHeight, audienceRawReportPrint.pageGeometry.height);
assert.equal(importedAudienceReportPrint.message, "Imported ReportPrint Capacity Audience Segment Index Q3. Inspect or download is ready.");
assert.equal(importedAudienceReportPrint.payload?.kind, "reportPrint");

const rawExportRequest = savedReportRecordFixture?.exportRequest;
const importedExportRequest = parseReportBuilderLocalImport(JSON.stringify(rawExportRequest), {
    fileName: "capacity-kpi-blend.export-request.json",
});

assert.equal(importedExportRequest.valid, true);
assert.equal(importedExportRequest.kind, "reportExportRequest");
assert.equal(importedExportRequest.fileName, "capacity-kpi-blend.export-request.json");
assert.equal(importedExportRequest.title, "Capacity KPI Blend Q3");
assert.equal(importedExportRequest.format, "PDF");
assert.equal(importedExportRequest.from, "savedPayload");
assert.equal(importedExportRequest.message, "Imported report export request Capacity KPI Blend Q3. Review or export is ready.");
assert.equal(importedExportRequest.payload?.kind, "reportExportRequest");
assert.deepEqual(importedExportRequest.payload?.__validationErrors, []);
assert.equal(importedExportRequest.payload?.reportSpec?.kind, "reportSpec");
assert.equal(importedExportRequest.payload?.reportFill?.kind, "reportFill");
assert.equal(importedExportRequest.payload?.reportPrint?.kind, "reportPrint");

const rawReportSpec = savedReportRecordFixture?.savedReportPayload?.reportSpec;
const importedReportSpec = parseReportBuilderLocalImport(JSON.stringify(rawReportSpec), {
    fileName: "capacity-kpi-blend.report-spec.json",
});

assert.equal(importedReportSpec.valid, true);
assert.equal(importedReportSpec.kind, "reportSpec");
assert.equal(importedReportSpec.fileName, "capacity-kpi-blend.report-spec.json");
assert.equal(importedReportSpec.title, "Capacity KPI Blend Q3");
assert.equal(importedReportSpec.blockCount, rawReportSpec.blocks.length);
assert.equal(importedReportSpec.datasetCount, rawReportSpec.datasets.length);
assert.equal(importedReportSpec.message, "Imported ReportSpec Capacity KPI Blend Q3. Compiled local runtime preview is ready.");
assert.equal(importedReportSpec.runtimeArtifact?.reportSpec?.kind, "reportSpec");
assert.equal(importedReportSpec.runtimeArtifact?.reportFill?.kind, "reportFill");
assert.equal(importedReportSpec.runtimeArtifact?.reportPrint?.kind, "reportPrint");
assert.equal(importedReportSpec.runtimeArtifact?.runtimeBlock?.kind, "dashboard.reportRuntime");
assert.equal(importedReportSpec.runtimeArtifact?.runtimeBlock?.title, "Capacity KPI Blend Q3");
assert.equal(importedReportSpec.runtimeArtifact?.runtimeBlock?.subtitle, "Local runtime preview compiled directly from the imported ReportSpec file.");
assert.equal(importedReportSpec.runtimeArtifact?.exportRequest?.kind, "reportExportRequest");
assert.equal(importedReportSpec.runtimeArtifact?.exportRequest?.reportSpec?.kind, "reportSpec");
assert.equal(importedReportSpec.runtimeArtifact?.exportRequest?.reportFill?.kind, "reportFill");
assert.deepEqual(importedReportSpec.runtimeArtifact?.reportFill?.datasets?.map((dataset) => dataset.rows?.length || 0), [0]);

const rawReportDocument = {
    version: 1,
    kind: "reportDocument",
    id: "capacityTrendQ3",
    title: "Capacity Trend Q3",
    blocks: [],
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(rawReportDocument), {
    fileName: "capacity-trend.report-document.json",
}), {
    valid: true,
    kind: "reportDocument",
    payload: rawReportDocument,
    fileName: "capacity-trend.report-document.json",
    title: "Capacity Trend Q3",
    documentVersion: 1,
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "capacityTrendQ3",
        },
        documentVersion: 1,
        savedAt: 0,
        document: rawReportDocument,
        importedArtifactKind: "reportDocument",
    },
    message: "Imported ReportDocument Capacity Trend Q3. Reopen in builder is ready.",
});

const rawSemanticReportDocument = {
    version: 1,
    kind: "reportDocument",
    id: "embeddedBindingTrendQ3",
    title: "Embedded Binding Trend Q3",
    blocks: [
        {
            id: "primaryBuilder",
            kind: "reportBuilderBlock",
            source: {
                kind: "dashboard.reportBuilder",
                dataSourceRef: "demoReportSource",
            },
            config: {
                dimensions: [
                    { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Delivery Date" },
                    { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions" },
                ],
                staticFilters: [
                    {
                        id: "dateRange",
                        type: "dateRange",
                        label: "Reporting Window",
                        description: "Embedded imported scope metadata.",
                        required: true,
                    },
                ],
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date"],
                    selectedMeasures: ["available_impressions"],
                },
            },
            state: {
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date", "channel"],
                    selectedMeasures: ["available_impressions"],
                },
                staticFilters: {
                    dateRange: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            },
        },
    ],
};

const importedRawSemanticReportDocument = parseReportBuilderLocalImport(JSON.stringify(rawSemanticReportDocument), {
    fileName: "embedded-binding.report-document.json",
});
assert.equal(importedRawSemanticReportDocument.valid, true);
assert.equal(importedRawSemanticReportDocument.kind, "reportDocument");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.reportSpec?.kind, "reportSpec");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.reportSpec?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.reportSpec?.scope?.dataSourceRef, "demoReportSource");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.compileState?.status, "clean");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.compileState?.reportSpecVersion, 1);
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.compileState?.blockCount, 1);
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.compileState?.datasetCount, 1);
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.binding?.entity, "line_delivery");
assert.deepEqual(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.binding?.selectedDimensions, ["event_date", "channel"]);
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.semanticSummary?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.semanticSummary?.selectedDimensions?.[1]?.label, "Channel");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.semanticSummary?.selectedMeasures?.[0]?.label, "Available Impressions");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.scope?.dataSourceRef, "demoReportSource");
assert.equal(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.scope?.params?.[0]?.label, "Reporting Window");
assert.deepEqual(importedRawSemanticReportDocument.getReportDocumentResponse?.document?.scope?.params?.[0]?.value, {
    start: "2026-05-01",
    end: "2026-05-04",
});

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_demo",
    savedAt: 1000,
    title: "Imported Saved Payload",
    sourceArtifactId: "demo_payload",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Imported Saved Payload",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(savedReportPayload), {
    fileName: "saved-report.json",
}), {
    valid: true,
    kind: "reportBuilder.savedReportPayload",
    payload: savedReportPayload,
    fileName: "saved-report.json",
    title: "Imported Saved Payload",
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "demoReportBuilder",
        },
        documentVersion: 1,
        savedAt: 1000,
        document: savedReportPayload.reportDocument,
        reportSpec: savedReportPayload.reportSpec,
        compileState: {
            status: "clean",
            reportSpecVersion: 1,
            blockCount: 1,
            datasetCount: 1,
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_demo",
            sourceArtifactId: "demo_payload",
        },
        importedArtifactKind: "reportBuilder.savedReportPayload",
    },
    message: "Imported saved report payload Imported Saved Payload. Reopen in builder is ready.",
});

const detailTargetImportedFixture = buildReportBuilderDetailTargetImportedArtifactFixtureState();
const importedDetailTargetSavedPayload = parseReportBuilderLocalImport(
    JSON.stringify(detailTargetImportedFixture.savedReportPayload),
    {
        fileName: "detail-target.saved-report-payload.json",
    },
);
assert.equal(importedDetailTargetSavedPayload.valid, true);
assert.equal(importedDetailTargetSavedPayload.kind, "reportBuilder.savedReportPayload");
assert.equal(importedDetailTargetSavedPayload.title, "Imported Detail Target Modal Demo");
assert.equal(importedDetailTargetSavedPayload.getReportDocumentResponse?.reportRef?.reportId, "importedDetailTargetModalDemo");
assert.equal(importedDetailTargetSavedPayload.getReportDocumentResponse?.documentVersion, 1);
assert.deepEqual(importedDetailTargetSavedPayload.getReportDocumentResponse?.reportSpec?.drillMetadata, {
    hierarchies: [],
    detailTargets: [
        {
            targetRef: "target://example/performance/channel-detail-modal",
            navigationMode: "modal",
            title: "Archived Channel detail",
            description: "Open the archived channel detail route.",
            parameters: {
                channel: "$value",
                eventDate: "$row.eventDate",
                source: "archived",
            },
        },
    ],
    fieldActions: [
        {
            fieldRef: "channelV2",
            actions: [
                {
                    id: "detail:channelV2:target:_example_performance_channel-detail-modal",
                    label: "Show Channel details",
                    kind: "detail",
                    targetRef: "target://example/performance/channel-detail-modal",
                },
            ],
        },
    ],
});
assert.equal(importedDetailTargetSavedPayload.message, "Imported saved report payload Imported Detail Target Modal Demo. Reopen in builder is ready.");

const importedSavedViewArtifact = detailTargetImportedFixture.savedViewArtifact;

const importedSavedView = parseReportBuilderLocalImport(JSON.stringify(importedSavedViewArtifact), {
    fileName: "detail-target.saved-view.json",
});

assert.equal(importedSavedView.valid, true);
assert.equal(importedSavedView.kind, "reportBuilder.savedView");
assert.equal(importedSavedView.fileName, "detail-target.saved-view.json");
assert.equal(importedSavedView.title, "Imported Detail Target Modal Saved View");
assert.equal(importedSavedView.documentVersion, 24);
assert.equal(importedSavedView.exportable, true);
assert.equal(importedSavedView.savedRecord?.source?.kind, "reportBuilder.savedView");
assert.equal(importedSavedView.savedRecord?.source?.sourceArtifactId, "saved_view_imported_detail_target_modal");
assert.equal(importedSavedView.savedRecord?.exportRequest?.source?.from, "savedView");
assert.equal(importedSavedView.getReportDocumentResponse?.reportRef?.reportId, "importedDetailTargetModalDemo");
assert.equal(importedSavedView.getReportDocumentResponse?.documentVersion, 24);
assert.equal(importedSavedView.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.savedView");
assert.deepEqual(importedSavedView.getReportDocumentResponse?.reportSpec?.drillMetadata, detailTargetImportedFixture.getReportDocumentResponse.reportSpec.drillMetadata);
assert.equal(importedSavedView.message, "Imported saved view Imported Detail Target Modal Saved View. Reopen and export are ready.");

const importedThinSavedViewArtifact = {
    version: 1,
    kind: "reportBuilder.savedView",
    id: importedSavedViewArtifact.id,
    title: `${importedSavedViewArtifact.title} Overlay`,
    reportId: importedSavedViewArtifact.reportId,
    documentVersion: importedSavedViewArtifact.documentVersion,
    savedAt: importedSavedViewArtifact.savedAt,
    document: {
        ...importedSavedViewArtifact.document,
        title: `${importedSavedViewArtifact.document.title} Overlay`,
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://importedDetailTargetModalDemo",
            reportId: "importedDetailTargetModalDemo",
            documentVersion: importedSavedViewArtifact.documentVersion,
        },
        overlay: {
            filters: {
                dateRange: {
                    start: "2026-05-01",
                    end: "2026-05-04",
                },
            },
            presentation: {
                viewMode: "table",
            },
        },
    },
};

const importedThinSavedView = parseReportBuilderLocalImport(JSON.stringify(importedThinSavedViewArtifact), {
    fileName: "detail-target.saved-view.overlay.json",
});

assert.equal(importedThinSavedView.valid, true);
assert.equal(importedThinSavedView.kind, "reportBuilder.savedView");
assert.equal(importedThinSavedView.exportable, false);
assert.equal(importedThinSavedView.savedRecord?.source?.kind, "reportBuilder.savedView");
assert.equal(importedThinSavedView.savedRecord?.exportRequest, undefined);
assert.equal(importedThinSavedView.savedRecord?.savedViewOverlay?.overlay?.presentation?.viewMode, "table");
assert.equal(importedThinSavedView.getReportDocumentResponse?.reportRef?.reportId, "importedDetailTargetModalDemo");
assert.equal(importedThinSavedView.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.savedView");
assert.equal(importedThinSavedView.getReportDocumentResponse?.savedViewOverlay?.overlay?.filters?.dateRange?.start, "2026-05-01");
assert.deepEqual(importedThinSavedView.getReportDocumentResponse?.reportSpec?.drillMetadata, detailTargetImportedFixture.getReportDocumentResponse.reportSpec.drillMetadata);
assert.equal(importedThinSavedView.message, "Imported saved view Imported Detail Target Modal Saved View Overlay. Reopen is ready; export needs a local export-ready artifact.");

const importedPublishedSnapshotArtifact = detailTargetImportedFixture.publishedSnapshotArtifact;

const importedPublishedSnapshot = parseReportBuilderLocalImport(JSON.stringify(importedPublishedSnapshotArtifact), {
    fileName: "detail-target.published-snapshot.json",
});

assert.equal(importedPublishedSnapshot.valid, true);
assert.equal(importedPublishedSnapshot.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedPublishedSnapshot.fileName, "detail-target.published-snapshot.json");
assert.equal(importedPublishedSnapshot.title, "Imported Detail Target Modal Published Snapshot");
assert.equal(importedPublishedSnapshot.documentVersion, 25);
assert.equal(importedPublishedSnapshot.exportable, true);
assert.equal(importedPublishedSnapshot.savedRecord?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedPublishedSnapshot.savedRecord?.source?.sourceArtifactId, "published_snapshot_imported_detail_target_modal");
assert.equal(importedPublishedSnapshot.savedRecord?.exportRequest?.source?.from, "publishedSnapshot");
assert.equal(importedPublishedSnapshot.getReportDocumentResponse?.reportRef?.reportId, "importedDetailTargetModalDemo");
assert.equal(importedPublishedSnapshot.getReportDocumentResponse?.documentVersion, 25);
assert.equal(importedPublishedSnapshot.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.publishedSnapshot");
assert.deepEqual(importedPublishedSnapshot.getReportDocumentResponse?.reportSpec?.drillMetadata, detailTargetImportedFixture.getReportDocumentResponse.reportSpec.drillMetadata);
assert.equal(importedPublishedSnapshot.message, "Imported published snapshot Imported Detail Target Modal Published Snapshot. Reopen and export are ready.");

const importedThinPublishedSnapshotArtifact = {
    version: 1,
    kind: "reportBuilder.publishedSnapshot",
    id: importedPublishedSnapshotArtifact.id,
    title: `${importedPublishedSnapshotArtifact.title} Overlay`,
    reportId: importedPublishedSnapshotArtifact.reportId,
    documentVersion: importedPublishedSnapshotArtifact.documentVersion,
    savedAt: importedPublishedSnapshotArtifact.savedAt,
    document: {
        ...importedPublishedSnapshotArtifact.document,
        title: `${importedPublishedSnapshotArtifact.document.title} Overlay`,
    },
};

const importedThinPublishedSnapshot = parseReportBuilderLocalImport(JSON.stringify(importedThinPublishedSnapshotArtifact), {
    fileName: "detail-target.published-snapshot.overlay.json",
});

assert.equal(importedThinPublishedSnapshot.valid, true);
assert.equal(importedThinPublishedSnapshot.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedThinPublishedSnapshot.exportable, false);
assert.equal(importedThinPublishedSnapshot.savedRecord?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedThinPublishedSnapshot.savedRecord?.exportRequest, undefined);
assert.equal(importedThinPublishedSnapshot.getReportDocumentResponse?.reportRef?.reportId, "importedDetailTargetModalDemo");
assert.equal(importedThinPublishedSnapshot.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.publishedSnapshot");
assert.deepEqual(importedThinPublishedSnapshot.getReportDocumentResponse?.reportSpec?.drillMetadata, detailTargetImportedFixture.getReportDocumentResponse.reportSpec.drillMetadata);
assert.equal(importedThinPublishedSnapshot.message, "Imported published snapshot Imported Detail Target Modal Published Snapshot Overlay. Reopen is ready; export needs a local export-ready artifact.");

const importedExplorationArtifact = {
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_semantic_import_2000",
    savedAt: 2000,
    title: "Imported Semantic Draft",
    sourceSession: {
        sessionId: "rbexplore_semantic_2000",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • CTV",
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "semanticImportDemo",
        title: "Imported Semantic Draft",
        subtitle: "Semantic Import",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    kind: "dashboard.reportBuilder",
                    containerId: "semanticImportDemo",
                    stateKey: "semanticImportDemo",
                    dataSourceRef: "demoReportSource",
                },
                config: {
                    measures: [
                        { id: "spend", key: "spend", semanticRef: "total_spend", label: "Spend", default: true, format: "currency" },
                    ],
                    dimensions: [
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", default: true, chartAxis: true, format: "date" },
                        { id: "channel", key: "channel", semanticRef: "channel", label: "Channel", default: true },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            required: true,
                            startParamPath: "filters.from",
                            endParamPath: "filters.to",
                        },
                    ],
                    result: {
                        defaultMode: "chart",
                        chartCreationMode: "explicit",
                    },
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["total_spend"],
                    },
                },
                state: {
                    selectedMeasures: ["spend"],
                    primaryMeasure: "spend",
                    selectedDimensions: ["eventDate", "channel"],
                    viewMode: "chart",
                    chartSpec: {
                        title: "Spend by Date",
                        type: "line",
                        xField: "eventDate",
                        yFields: ["spend"],
                    },
                    staticFilters: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["total_spend"],
                    },
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Imported Semantic Draft",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
        semanticSummary: {
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend"],
        },
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
};

const importedExplorationSnapshot = parseReportBuilderLocalImport(JSON.stringify(importedExplorationArtifact), {
    fileName: "semantic-draft.exploration-artifact.json",
});

assert.equal(importedExplorationSnapshot.valid, true);
assert.equal(importedExplorationSnapshot.kind, "reportBuilder.explorationArtifact");
assert.equal(importedExplorationSnapshot.fileName, "semantic-draft.exploration-artifact.json");
assert.equal(importedExplorationSnapshot.title, "Imported Semantic Draft");
assert.equal(importedExplorationSnapshot.savedReportPayload?.kind, "reportBuilder.savedReportPayload");
assert.equal(importedExplorationSnapshot.savedReportPayload?.payloadId, "rbreport_rbexploration_semantic_import_2000");
assert.equal(importedExplorationSnapshot.savedReportPayload?.sourceArtifactId, "rbexploration_semantic_import_2000");
assert.equal(importedExplorationSnapshot.getReportDocumentResponse?.kind, "getReportDocumentResponse");
assert.equal(importedExplorationSnapshot.getReportDocumentResponse?.reportRef?.reportId, "semanticImportDemo");
assert.equal(importedExplorationSnapshot.getReportDocumentResponse?.source?.payloadId, "rbreport_rbexploration_semantic_import_2000");
assert.equal(importedExplorationSnapshot.getReportDocumentResponse?.importedArtifactKind, "reportBuilder.explorationArtifact");
assert.equal(importedExplorationSnapshot.message, "Imported draft snapshot Imported Semantic Draft. Reusable report file and builder reopen are ready.");

const hydratedImportedExplorationSnapshot = buildHydratedReportBuilderDocument(importedExplorationSnapshot.getReportDocumentResponse, {
    container: {
        id: "semanticImportDemo",
        stateKey: "semanticImportDemo",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity: {
        containerId: "semanticImportDemo",
        stateKey: "semanticImportDemo",
        dataSourceRef: "demoReportSource",
    },
});
assert.equal(hydratedImportedExplorationSnapshot.valid, true);
assert.equal(hydratedImportedExplorationSnapshot.config.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(hydratedImportedExplorationSnapshot.state.binding?.entity, "line_delivery");
assert.deepEqual(hydratedImportedExplorationSnapshot.state.binding?.selectedDimensions, ["event_date", "channel"]);
assert.deepEqual(hydratedImportedExplorationSnapshot.state.binding?.selectedMeasures, ["total_spend"]);

const getResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    documentVersion: 6,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(getResponse), {
    fileName: "trend-get-response.json",
}), {
    valid: true,
    kind: "getReportDocumentResponse",
    payload: {
        ...getResponse,
        importedArtifactKind: "getReportDocumentResponse",
    },
    fileName: "trend-get-response.json",
    title: "Capacity Trend Q3",
    documentVersion: 6,
    message: "Imported reopen bundle Capacity Trend Q3.",
});

const importedAudienceGetResponse = parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.legacyGetReportDocumentResponse), {
    fileName: "audience-get-response.json",
});
assert.equal(importedAudienceGetResponse.valid, true);
assert.equal(importedAudienceGetResponse.kind, "getReportDocumentResponse");
assert.equal(importedAudienceGetResponse.payload.document.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(importedAudienceGetResponse.payload.document.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(importedAudienceGetResponse.payload.document.scope.params[2].id, "audienceSegmentFilter");

const hydratedImportedAudienceGetResponse = buildHydratedReportBuilderDocument(importedAudienceGetResponse.payload, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
});
assert.equal(hydratedImportedAudienceGetResponse.valid, true);
assert.deepEqual(hydratedImportedAudienceGetResponse.state.staticFilters?.audienceSegmentFilter, ["Young Adults"]);

const listResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: {
                reportId: "capacityTrendQ3",
            },
            documentVersion: 6,
            title: "Capacity Trend Q3",
        },
        {
            reportRef: {
                reportId: "capacityQ3",
            },
            documentVersion: 7,
            title: "Capacity Q3",
        },
    ],
    cursor: "next-page",
    hasMore: true,
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(listResponse), {
    fileName: "list-response.json",
}), {
    valid: true,
    kind: "listReportDocumentsResponse",
    payload: listResponse,
    fileName: "list-response.json",
    entryCount: 2,
    selectedEntryKey: "capacityTrendQ3",
    selectedReportId: "capacityTrendQ3",
    message: "Imported catalog response with 2 entries.",
});

const duplicateListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: {
                reportId: "capacityShared",
            },
            documentVersion: 8,
            title: "Capacity Shared Saved View",
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityShared",
                sourceArtifactId: "saved_view_capacity_shared",
            },
        },
        {
            reportRef: {
                reportId: "capacityShared",
            },
            documentVersion: 9,
            title: "Capacity Shared Published Snapshot",
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityShared",
                sourceArtifactId: "published_snapshot_capacity_shared",
            },
        },
    ],
};
assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(duplicateListResponse), {
    fileName: "duplicate-list-response.json",
}), {
    valid: true,
    kind: "listReportDocumentsResponse",
    payload: duplicateListResponse,
    fileName: "duplicate-list-response.json",
    entryCount: 2,
    selectedEntryKey: buildReportBuilderListReportDocumentsEntrySelectionKey(duplicateListResponse.entries[0]),
    selectedReportId: buildReportBuilderListReportDocumentsEntrySelectionKey(duplicateListResponse.entries[0]),
    message: "Imported catalog response with 2 entries.",
});

const createPayload = {
    version: 1,
    kind: "createReportDocumentPayload",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    title: "Capacity Trend Q3",
    document: {
        title: "Capacity Trend Q3",
    },
    compileState: {
        status: "clean",
        blockCount: 2,
        datasetCount: 1,
    },
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(createPayload), {
    fileName: "create-report.json",
}), {
    valid: true,
    kind: "createReportDocumentPayload",
    payload: createPayload,
    fileName: "create-report.json",
    title: "Capacity Trend Q3",
    message: "Imported create request Capacity Trend Q3.",
});

const updatePayload = {
    version: 1,
    kind: "updateReportDocumentPayload",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    title: "Capacity Trend Q3",
    expectedVersion: 7,
    document: {
        title: "Capacity Trend Q3",
    },
    compileState: {
        status: "clean",
        blockCount: 2,
        datasetCount: 1,
    },
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(updatePayload), {
    fileName: "update-report.json",
}), {
    valid: true,
    kind: "updateReportDocumentPayload",
    payload: updatePayload,
    fileName: "update-report.json",
    title: "Capacity Trend Q3",
    expectedVersion: 7,
    message: "Imported update request Capacity Trend Q3.",
});

const reopenableImportedDocument = {
    version: 1,
    kind: "reportDocument",
    id: "demoReportBuilder",
    title: "Imported Dependent Derived Demo",
    blocks: [
        {
            id: "primaryBuilder",
            kind: "reportBuilderBlock",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "demoReportBuilder",
                stateKey: "demoReportBuilder",
                dataSourceRef: "demoReportSource",
            },
            config: {
                measures: [
                    { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Avails", default: true, format: "compactNumber" },
                ],
                dimensions: [
                    { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", default: true, chartAxis: true, format: "date" },
                    { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", default: true },
                ],
                staticFilters: [
                    {
                        id: "dateRange",
                        type: "dateRange",
                        required: true,
                        startParamPath: "filters.From",
                        endParamPath: "filters.To",
                    },
                ],
                result: {
                    chartCreationMode: "explicit",
                    defaultMode: "chart",
                    pageSize: 50,
                    orderFields: [
                        { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
                    ],
                },
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date", "channel"],
                    selectedMeasures: ["available_impressions"],
                },
            },
            state: {
                selectedMeasures: ["runningCtvAvails"],
                primaryMeasure: "runningCtvAvails",
                selectedDimensions: ["eventDate", "channelV2"],
                viewMode: "chart",
                chartSpec: {
                    title: "Running CTV Avails by Date",
                    type: "line",
                    xField: "eventDate",
                    yFields: ["runningCtvAvails"],
                },
                staticFilters: {
                    dateRange: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date", "channel"],
                    selectedMeasures: ["available_impressions"],
                },
                localCalculatedFields: [
                    {
                        id: "ctvAvails",
                        key: "ctvAvails",
                        kind: "rowCalc",
                        label: "CTV Avails",
                        dataType: "number",
                        format: "compactNumber",
                        datasetRef: "primary",
                        dependencies: ["channelV2", "avails"],
                        expr: "if(channelV2 = 'CTV', avails, null)",
                    },
                ],
                localTableCalculations: [
                    {
                        id: "runningCtvAvails",
                        key: "runningCtvAvails",
                        kind: "tableCalc",
                        label: "Running CTV Avails",
                        dataType: "number",
                        format: "compactNumber",
                        datasetRef: "primary",
                        dependencies: ["ctvAvails", "eventDate", "channelV2"],
                        compute: {
                            type: "runningTotal",
                            sourceField: "ctvAvails",
                            partitionBy: ["channelV2"],
                            orderBy: [
                                { field: "eventDate", direction: "asc" },
                            ],
                        },
                    },
                ],
            },
        },
    ],
};

const reopenableCreatePayload = {
    version: 1,
    kind: "createReportDocumentPayload",
    createdAt: 1700,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Imported Dependent Derived Demo",
    document: reopenableImportedDocument,
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_dependent_create",
        sourceArtifactId: "imported_dependent_create",
    },
};

const importedReopenableCreatePayload = parseReportBuilderLocalImport(JSON.stringify(reopenableCreatePayload), {
    fileName: "dependent-create-report.json",
});
assert.equal(importedReopenableCreatePayload.valid, true);
assert.equal(importedReopenableCreatePayload.kind, "createReportDocumentPayload");
assert.equal(importedReopenableCreatePayload.title, "Imported Dependent Derived Demo");
assert.equal(importedReopenableCreatePayload.message, "Imported create request Imported Dependent Derived Demo. Reopen in builder is ready.");
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.kind, "getReportDocumentResponse");
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.reportRef?.reportId, "demoReportBuilder");
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.documentVersion, 1);
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.savedAt, 1700);
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.compileState?.status, "clean");
assert.equal(importedReopenableCreatePayload.getReportDocumentResponse?.importedArtifactKind, "createReportDocumentPayload");

const hydratedImportedCreatePayload = buildHydratedReportBuilderDocument(importedReopenableCreatePayload.getReportDocumentResponse, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
});
assert.equal(hydratedImportedCreatePayload.valid, true);
assert.equal(hydratedImportedCreatePayload.state.localCalculatedFields[0].id, "ctvAvails");
assert.equal(hydratedImportedCreatePayload.state.localTableCalculations[0].id, "runningCtvAvails");
assert.equal(hydratedImportedCreatePayload.state.localTableCalculations[0].compute.sourceField, "ctvAvails");

const importedCreateRuntimeModel = buildReportBuilderRuntimePreviewModel({
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: hydratedImportedCreatePayload.config,
    state: hydratedImportedCreatePayload.state,
});
const importedCreateRuntimePreview = buildReportBuilderRuntimePreview({
    model: importedCreateRuntimeModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 12000 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 34300 },
        { eventDate: "2026-05-03", channelV2: "CTV", avails: 36000 },
    ],
    hasMore: false,
});
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[0].ctvAvails, null);
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[1].ctvAvails, 34300);
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[2].ctvAvails, 36000);
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[0].runningCtvAvails, 0);
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[1].runningCtvAvails, 34300);
assert.equal(importedCreateRuntimePreview.reportFill.datasets[0].rows[2].runningCtvAvails, 70300);

const reopenableUpdatePayload = {
    ...reopenableCreatePayload,
    kind: "updateReportDocumentPayload",
    updatedAt: 1750,
    expectedVersion: 11,
};
const importedReopenableUpdatePayload = parseReportBuilderLocalImport(JSON.stringify(reopenableUpdatePayload), {
    fileName: "dependent-update-report.json",
});
assert.equal(importedReopenableUpdatePayload.valid, true);
assert.equal(importedReopenableUpdatePayload.kind, "updateReportDocumentPayload");
assert.equal(importedReopenableUpdatePayload.expectedVersion, 11);
assert.equal(importedReopenableUpdatePayload.message, "Imported update request Imported Dependent Derived Demo. Reopen in builder is ready.");
assert.equal(importedReopenableUpdatePayload.getReportDocumentResponse?.kind, "getReportDocumentResponse");
assert.equal(importedReopenableUpdatePayload.getReportDocumentResponse?.documentVersion, 1);
assert.equal(importedReopenableUpdatePayload.getReportDocumentResponse?.savedAt, 1750);
assert.equal(importedReopenableUpdatePayload.getReportDocumentResponse?.importedArtifactKind, "updateReportDocumentPayload");

const thinSpecCreatePayload = {
    version: 1,
    kind: "createReportDocumentPayload",
    createdAt: 1800,
    reportRef: {
        reportId: "embeddedBindingTrendQ3",
    },
    title: "Embedded Binding Trend Q3",
    document: rawSemanticReportDocument,
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Embedded Binding Trend Q3",
        blocks: [],
        datasets: [],
        semanticSummary: {
            kind: "semantic",
            selectedDimensions: [],
            selectedMeasures: [],
        },
        scope: {
            params: [],
        },
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 0,
        datasetCount: 0,
    },
};

const importedThinSpecCreatePayload = parseReportBuilderLocalImport(JSON.stringify(thinSpecCreatePayload), {
    fileName: "embedded-binding.create-report.json",
});
assert.equal(importedThinSpecCreatePayload.valid, true);
assert.equal(importedThinSpecCreatePayload.kind, "createReportDocumentPayload");
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.documentVersion, 1);
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.reportSpec?.semanticSummary?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.reportSpec?.semanticSummary?.selectedDimensions?.[1]?.label, "Channel");
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.reportSpec?.scope?.params?.[0]?.label, "Reporting Window");
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.document?.semanticSummary?.selectedMeasures?.[0]?.label, "Available Impressions");
assert.equal(importedThinSpecCreatePayload.getReportDocumentResponse?.document?.scope?.params?.[0]?.label, "Reporting Window");

const importedAudienceSavedPayload = parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.legacySavedReportPayload), {
    fileName: "audience-saved-report.json",
});
assert.equal(importedAudienceSavedPayload.valid, true);
assert.equal(importedAudienceSavedPayload.kind, "reportBuilder.savedReportPayload");
assert.equal(importedAudienceSavedPayload.getReportDocumentResponse?.document?.semanticSummary?.selectedMeasures?.[0]?.definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(importedAudienceSavedPayload.getReportDocumentResponse?.document?.semanticSummary?.selectedParameters?.[1]?.definitionRef, "harmonizer://feature/user.segment");
assert.equal(importedAudienceSavedPayload.getReportDocumentResponse?.document?.scope?.params?.[2]?.id, "audienceSegmentFilter");
assert.equal(importedAudienceSavedPayload.getReportDocumentResponse?.document?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedAudienceSavedPayload.getReportDocumentResponse?.document?.binding?.entity, "line_delivery");

const hydratedImportedAudienceSavedPayload = buildHydratedReportBuilderDocument(importedAudienceSavedPayload.getReportDocumentResponse, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
});
assert.equal(hydratedImportedAudienceSavedPayload.valid, true);
assert.deepEqual(hydratedImportedAudienceSavedPayload.state.staticFilters?.audienceSegmentFilter, ["Young Adults"]);

const importedAudienceSavedRecord = parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.legacySavedReportRecord), {
    fileName: "audience-saved-record.json",
});
assert.equal(importedAudienceSavedRecord.valid, true);
assert.equal(importedAudienceSavedRecord.kind, "reportBuilder.savedReportRecord");
assert.equal(importedAudienceSavedRecord.getReportDocumentResponse?.document?.semanticSummary?.selectedMeasures?.[0]?.definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(importedAudienceSavedRecord.getReportDocumentResponse?.document?.semanticSummary?.selectedParameters?.[1]?.definitionRef, "harmonizer://feature/user.segment");
assert.equal(importedAudienceSavedRecord.getReportDocumentResponse?.document?.scope?.params?.[2]?.id, "audienceSegmentFilter");
assert.equal(importedAudienceSavedRecord.getReportDocumentResponse?.document?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(importedAudienceSavedRecord.getReportDocumentResponse?.document?.binding?.entity, "line_delivery");

assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.savedReportPayload), {
    fileName: "audience-pack.saved-report.json",
}).kind, "reportBuilder.savedReportPayload");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.savedReportRecord), {
    fileName: "audience-pack.saved-record.json",
}).kind, "reportBuilder.savedReportRecord");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.getReportDocumentResponse), {
    fileName: "audience-pack.get-response.json",
}).kind, "getReportDocumentResponse");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.listReportDocumentsResponse), {
    fileName: "audience-pack.list-response.json",
}).kind, "listReportDocumentsResponse");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.createReportDocumentPayload), {
    fileName: "audience-pack.create.json",
}).kind, "createReportDocumentPayload");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.updateReportDocumentPayload), {
    fileName: "audience-pack.update.json",
}).kind, "updateReportDocumentPayload");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.reportExportRequest), {
    fileName: "audience-pack.export.json",
}).kind, "reportExportRequest");
const importedAudiencePDFExportRequest = parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.pdfReportExportRequest), {
    fileName: "audience-pack.export-pdf.json",
});
assert.equal(importedAudiencePDFExportRequest.valid, true);
assert.equal(importedAudiencePDFExportRequest.kind, "reportExportRequest");
assert.equal(importedAudiencePDFExportRequest.title, "Capacity Audience Segment Index Q3");
assert.equal(importedAudiencePDFExportRequest.format, "PDF");
assert.equal(importedAudiencePDFExportRequest.from, "savedPayload");
assert.equal(importedAudiencePDFExportRequest.payload?.reportPrint?.kind, "reportPrint");
assert.equal(importedAudiencePDFExportRequest.message, "Imported report export request Capacity Audience Segment Index Q3. Review or export is ready.");
assert.equal(parseReportBuilderLocalImport(JSON.stringify(audienceArtifactFixture.getReportDocumentRequest), {
    fileName: "audience-pack.get-request.json",
}).kind, "getReportDocumentRequest");

const getRequest = {
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
};

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify(getRequest), {
    fileName: "get-request.json",
}), {
    valid: true,
    kind: "getReportDocumentRequest",
    payload: getRequest,
    fileName: "get-request.json",
    title: "capacityTrendQ3",
    message: "Imported get request capacityTrendQ3.",
});

assert.deepEqual(parseReportBuilderLocalImport(""), {
    valid: false,
    code: "emptyFile",
    fileName: "",
    message: "Could not import this local report file. The selected file is empty.",
});

assert.deepEqual(parseReportBuilderLocalImport("{not-json}", {
    fileName: "broken.json",
}), {
    valid: false,
    code: "invalidJson",
    fileName: "broken.json",
    message: "Could not import broken.json. The file does not contain valid JSON.",
});

assert.deepEqual(parseReportBuilderLocalImport(JSON.stringify({
    kind: "unsupportedReportArtifact",
}), {
    fileName: "unsupported-report.json",
}), {
    valid: false,
    code: "unsupportedKind",
    fileName: "unsupported-report.json",
    message: "Could not import unsupported-report.json. Supported local report files are reportFill, reportPrint, reportExportRequest, reportSpec, reportDocument, reportBuilder.explorationArtifact, reportBuilder.savedReportPayload, reportBuilder.savedReportRecord, reportBuilder.savedView, reportBuilder.publishedSnapshot, getReportDocumentResponse, listReportDocumentsResponse, createReportDocumentPayload, updateReportDocumentPayload, and getReportDocumentRequest JSON artifacts.",
});

const invalidReportSpec = parseReportBuilderLocalImport(JSON.stringify({
    version: 1,
    kind: "reportSpec",
    title: "Broken Spec",
}), {
    fileName: "broken.report-spec.json",
});

assert.equal(invalidReportSpec.valid, false);
assert.equal(invalidReportSpec.code, "invalidReportSpec");
assert.equal(invalidReportSpec.fileName, "broken.report-spec.json");
assert.match(invalidReportSpec.message, /The ReportSpec failed validation/);

const invalidReportFill = parseReportBuilderLocalImport(JSON.stringify({
    version: 1,
    kind: "reportFill",
    specVersion: 1,
    blocks: [],
}), {
    fileName: "broken.report-fill.json",
});

assert.equal(invalidReportFill.valid, false);
assert.equal(invalidReportFill.code, "invalidReportFill");
assert.equal(invalidReportFill.fileName, "broken.report-fill.json");
assert.match(invalidReportFill.message, /ReportFill failed validation/);

const invalidReportPrint = parseReportBuilderLocalImport(JSON.stringify({
    version: 1,
    kind: "reportPrint",
    title: "Broken Print",
    pages: [],
}), {
    fileName: "broken.report-print.json",
});

assert.equal(invalidReportPrint.valid, false);
assert.equal(invalidReportPrint.code, "invalidReportPrint");
assert.equal(invalidReportPrint.fileName, "broken.report-print.json");
assert.match(invalidReportPrint.message, /ReportPrint failed validation/);

const invalidConformanceExportRequestPayload = JSON.parse(JSON.stringify(rawExportRequest));
invalidConformanceExportRequestPayload.reportPrint.fillHash = "fnv1a:deadbeef";
const invalidConformanceExportRequest = parseReportBuilderLocalImport(JSON.stringify(invalidConformanceExportRequestPayload), {
    fileName: "stale.export-request.json",
});

assert.equal(invalidConformanceExportRequest.valid, false);
assert.equal(invalidConformanceExportRequest.code, "invalidReportExportRequest");
assert.equal(invalidConformanceExportRequest.fileName, "stale.export-request.json");
assert.match(invalidConformanceExportRequest.message, /report export request failed validation/i);

const invalidExportRequest = parseReportBuilderLocalImport(JSON.stringify({
    version: 1,
    kind: "reportExportRequest",
    target: {
        format: "pdf",
    },
    source: {
        from: "draft",
        artifactKind: "dashboard.reportBuilder",
        artifactRef: "dashboard.reportBuilder://demoReportBuilder",
        title: "Broken Export",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        title: "Broken Export",
        source: {},
        blocks: [],
        datasets: [],
    },
    reportFill: {
        version: 1,
        kind: "reportFill",
        specVersion: 1,
        specHash: "fnv1a:test",
        source: {},
        parameters: {},
        refinements: [],
        calculatedFields: [],
        datasets: [],
        blocks: [],
        diagnostics: [],
    },
}), {
    fileName: "broken.export-request.json",
});

assert.equal(invalidExportRequest.valid, false);
assert.equal(invalidExportRequest.code, "invalidReportExportRequest");
assert.equal(invalidExportRequest.fileName, "broken.export-request.json");
assert.match(invalidExportRequest.message, /report export request failed validation/i);

console.log("reportBuilderLocalImport ✓ validates and classifies local report JSON artifacts");
