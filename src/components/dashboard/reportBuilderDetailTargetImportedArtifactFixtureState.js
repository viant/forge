import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
import {
    buildReportBuilderGetReportDocumentResponse,
    buildReportBuilderListReportDocumentsResponse,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    buildReportFillFromReportSpec,
} from "../../reporting/reportFillModel.js";
import {
    buildReportPrintFromReportFill,
} from "../../reporting/reportPrintModel.js";

export function buildReportBuilderDetailTargetImportedArtifactFixtureState() {
    const container = {
        id: "importedDetailTargetModalBuilder",
        stateKey: "importedDetailTargetModalBuilder",
        title: "Imported Detail Target Modal Builder",
        dataSourceRef: "demoReportSource",
    };

    const config = {
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
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
            defaultMode: "table",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
    };

    const state = {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        drillMetadata: {
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
        },
    };

    const savedReportPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_detail_target_modal",
        savedAt: 10100,
        title: "Imported Detail Target Modal Demo",
        sourceArtifactId: "imported_detail_target_modal_demo",
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "importedDetailTargetModalDemo",
            title: "Imported Detail Target Modal Demo",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    }, {
        container,
        config,
        state,
        savedAt: 10110,
    });

    const savedReportRecord = {
        version: 1,
        kind: "reportBuilder.savedReportRecord",
        documentVersion: 24,
        savedAt: 10120,
        savedReportPayload,
    };
    const sharedReportFill = buildReportFillFromReportSpec(savedReportPayload.reportSpec, {
        primary: {
            rows: [
                {
                    eventDate: "2026-05-01",
                    channelV2: "CTV",
                    avails: 1200,
                },
            ],
            hasMore: false,
            diagnostics: [],
        },
    });
    const sharedReportPrint = buildReportPrintFromReportFill({
        reportSpec: savedReportPayload.reportSpec,
        reportFill: sharedReportFill,
    });

    const savedViewArtifact = {
        version: 1,
        kind: "reportBuilder.savedView",
        id: "saved_view_imported_detail_target_modal",
        title: "Imported Detail Target Modal Saved View",
        reportId: savedReportPayload.reportDocument.id,
        documentVersion: savedReportRecord.documentVersion,
        savedAt: savedReportRecord.savedAt,
        document: {
            ...savedReportPayload.reportDocument,
            title: "Imported Detail Target Modal Saved View",
        },
        reportSpec: savedReportRecord.savedReportPayload.reportSpec,
        reportFill: sharedReportFill,
        reportPrint: sharedReportPrint,
    };

    const publishedSnapshotArtifact = {
        version: 1,
        kind: "reportBuilder.publishedSnapshot",
        id: "published_snapshot_imported_detail_target_modal",
        title: "Imported Detail Target Modal Published Snapshot",
        reportId: savedReportPayload.reportDocument.id,
        documentVersion: savedReportRecord.documentVersion + 1,
        savedAt: savedReportRecord.savedAt + 10,
        document: {
            ...savedReportPayload.reportDocument,
            title: "Imported Detail Target Modal Published Snapshot",
        },
        reportSpec: savedReportRecord.savedReportPayload.reportSpec,
        reportFill: sharedReportFill,
        reportPrint: sharedReportPrint,
    };

    const getReportDocumentResponse = buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
        documentVersion: 24,
        savedAt: 10120,
    });
    const listReportDocumentsResponse = buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
        documentVersion: 24,
        savedAt: 10120,
        cursor: "next-page",
        hasMore: true,
    });

    return {
        container,
        config,
        state,
        savedReportPayload,
        savedReportRecord,
        savedViewArtifact,
        publishedSnapshotArtifact,
        getReportDocumentResponse,
        listReportDocumentsResponse,
    };
}
