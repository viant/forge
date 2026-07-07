import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildImportedLocalReopenablePanelState,
    buildImportedLocalSavedRecordPanelState,
    buildImportedPipelineExportActionState,
    buildImportedPipelineExportExecutionConfig,
    buildImportedPipelineExportFailureNotice,
    buildImportedPipelineExportJobPanelState,
    buildImportedPipelineExportRequestDetailPanelState,
    buildImportedPipelineExportStatusMetaChips,
    buildImportedPipelineInspectorState,
    buildImportedPipelinePreviewPanelState,
    buildImportedStandaloneExportActionState,
    buildImportedStandaloneExportExecutionConfig,
    buildImportedStandaloneExportFailureNotice,
    buildImportedStandaloneExportJobPanelState,
    buildImportedStandaloneExportRequestDetailPanelState,
    buildImportedStandaloneExportStatusMetaChips,
    buildImportedStandaloneReportFillPanelState,
    buildImportedStandaloneReportFillInspectorState,
    buildImportedStandaloneReportPrintPanelState,
    buildImportedStandaloneReportPrintInspectorState,
    buildImportedStandaloneExportRequestPanelState,
    buildImportedStandaloneExportRequestInspectorState,
} from "./reportBuilderImportedArtifactViewState.js";
import {
    buildReportBuilderExportRequestInspectorState,
    buildReportBuilderExportRequestSummary,
} from "./reportBuilderExportRequest.js";
import {
    buildReportBuilderDetailTargetImportedArtifactFixtureState,
} from "./reportBuilderDetailTargetImportedArtifactFixtureState.js";
import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);
const importedExportHandler = {
    submitRequest() {},
};
const importedFeedbackSink = () => {};
const importedLocalPayloads = [{ id: "saved-1" }];

assert.deepEqual(buildImportedStandaloneExportExecutionConfig({
    request: { id: "imported-request" },
    localSavedPayloads: importedLocalPayloads,
    reportExportHandler: importedExportHandler,
    setFeedback: importedFeedbackSink,
}), {
    request: { id: "imported-request" },
    sourceKind: "importedRequest",
    localSavedPayloads: importedLocalPayloads,
    reportExportHandler: importedExportHandler,
    setFeedback: importedFeedbackSink,
    missingRequestMessage: "No imported export request is available.",
    missingJobMessage: "No imported export job is available to refresh.",
    missingArtifactMessage: "No completed imported export artifact is available yet.",
});

assert.deepEqual(buildImportedPipelineExportExecutionConfig({
    request: { id: "pipeline-request" },
    localSavedPayloads: importedLocalPayloads,
    reportExportHandler: importedExportHandler,
    setFeedback: importedFeedbackSink,
}), {
    request: { id: "pipeline-request" },
    sourceKind: "imported",
    localSavedPayloads: importedLocalPayloads,
    reportExportHandler: importedExportHandler,
    setFeedback: importedFeedbackSink,
    missingRequestMessage: "No imported report export request is available.",
    missingJobMessage: "No imported report export job is available to refresh.",
    missingArtifactMessage: "No completed imported report export artifact is available yet.",
});

const detailTargetImportedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
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
    container: {
        id: "importedDetailTargetModalBuilder",
        stateKey: "importedDetailTargetModalBuilder",
        title: "Imported Detail Target Modal Builder",
        dataSourceRef: "demoReportSource",
    },
    config: {
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
    },
    state: {
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
    },
    savedAt: 10110,
});
const detailTargetImportedSharedArtifacts = buildReportBuilderDetailTargetImportedArtifactFixtureState();

const importedLocalReopenablePanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_trend::capacity_trend::capacityTrendQ3",
            title: "Capacity Trend Q3",
            reportId: "capacityTrendQ3",
            documentVersion: 6,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            scopeParams: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported reopen flows.",
                },
            ],
        },
        {
            id: "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported",
            title: "Capacity Trend Imported",
            reportId: "capacityTrendImported",
            documentVersion: 0,
            importedArtifactKind: "reportBuilder.explorationArtifact",
            scopeParams: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported reopen flows.",
                },
            ],
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                    { id: "channel", rawId: "channelV2", label: "Channel" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
            },
        },
    ],
    activeResponseIdentity: "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported",
});

assert.deepEqual(importedLocalReopenablePanelState, {
    title: "Imported reopen artifacts",
    description: "These imported local report artifacts can back imported catalog entries and reopen flows without server persistence.",
    metaChips: ["2 artifacts", "current reopen artifact tracked", "imported draft-snapshot"],
    entries: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_trend::capacity_trend::capacityTrendQ3",
            title: "Capacity Trend Q3",
            reportId: "capacityTrendQ3",
            importedArtifactKind: "reportBuilder.savedReportPayload",
            active: false,
            metaChips: ["capacityTrendQ3", "v6", "report-file artifact"],
            scopeSummaryTitle: "Filters",
            scopeSummaryText: "Reporting Window",
            scopeSummaryItems: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported reopen flows.",
                },
            ],
            activateLabel: "Use Capacity Trend Q3",
            removeLabel: "Remove Capacity Trend Q3",
        },
        {
            id: "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported",
            title: "Capacity Trend Imported",
            reportId: "capacityTrendImported",
            importedArtifactKind: "reportBuilder.explorationArtifact",
            active: true,
            metaChips: ["capacityTrendImported", "local-only", "draft-snapshot artifact"],
            semanticBindingTitle: "Semantic Binding",
            semanticBindingChips: [
                "Model Ad Delivery",
                "Entity Line Delivery",
                "Dimensions Delivery Date, Channel",
                "Measures Available Impressions",
            ],
            semanticBindingFieldGroups: [
                {
                    id: "dimensions",
                    title: "Selected dimensions (2)",
                    fields: [
                        { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                        { id: "channel", rawId: "channelV2", label: "Channel" },
                    ],
                },
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
                    description: "Approved reporting window for imported reopen flows.",
                },
            ],
            activateLabel: "",
            removeLabel: "Remove Capacity Trend Imported",
        },
    ],
    clearAllLabel: "Clear imported reopen artifacts",
});

const importedLocalReopenableTemplateConflictPanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "getReportDocumentResponse::templated_capacityTrendImported",
            title: "Capacity Trend Imported",
            reportId: "capacityTrendImported",
            documentVersion: 6,
            importedArtifactKind: "getReportDocumentResponse",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
        },
    ],
    activeResponseIdentity: "",
});
assert.equal(importedLocalReopenableTemplateConflictPanelState.metaChips.includes("template mismatch"), true);
assert.equal(importedLocalReopenableTemplateConflictPanelState.entries[0].metaChips.includes("template mismatch"), true);
assert.equal(importedLocalReopenableTemplateConflictPanelState.entries[0].notice.level, "warning");
assert.match(
    importedLocalReopenableTemplateConflictPanelState.entries[0].notice.message,
    /Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief\./,
);

const importedLocalSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
            reportId: "capacityKpiBlendByDateQ3",
            documentVersion: 9,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            scopeParams: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported saved records.",
                },
            ],
        },
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_q3_trend::capacity_q3_trend::capacityTrendQ3",
            title: "Capacity Trend Q3",
            reportId: "capacityTrendQ3",
            documentVersion: 6,
            exportable: false,
            importedArtifactKind: "reportBuilder.explorationArtifact",
            scopeParams: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported saved records.",
                },
            ],
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                    { id: "channel", rawId: "channelV2", label: "Channel" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
            },
        },
    ],
    activeRecordIdentity: "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3",
});

assert.deepEqual(importedLocalSavedRecordPanelState, {
    title: "Imported report files",
    description: "These imported local report files keep richer reopen and export context available without server persistence.",
    metaChips: ["2 records", "current report file tracked", "export-ready available", "imported draft-snapshot"],
    entries: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
            reportId: "capacityKpiBlendByDateQ3",
            importedArtifactKind: "reportBuilder.savedReportRecord",
            active: true,
            metaChips: ["capacityKpiBlendByDateQ3", "v9", "export-ready", "report-record artifact"],
            scopeSummaryTitle: "Filters",
            scopeSummaryText: "Reporting Window",
            scopeSummaryItems: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported saved records.",
                },
            ],
            activateLabel: "",
            removeLabel: "Remove Capacity KPI Blend Q3",
        },
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_q3_trend::capacity_q3_trend::capacityTrendQ3",
            title: "Capacity Trend Q3",
            reportId: "capacityTrendQ3",
            importedArtifactKind: "reportBuilder.explorationArtifact",
            active: false,
            metaChips: ["capacityTrendQ3", "v6", "reopen-ready", "draft-snapshot artifact"],
            semanticBindingTitle: "Semantic Binding",
            semanticBindingChips: [
                "Model Ad Delivery",
                "Entity Line Delivery",
                "Dimensions Delivery Date, Channel",
                "Measures Available Impressions",
            ],
            semanticBindingFieldGroups: [
                {
                    id: "dimensions",
                    title: "Selected dimensions (2)",
                    fields: [
                        { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                        { id: "channel", rawId: "channelV2", label: "Channel" },
                    ],
                },
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
                    description: "Approved reporting window for imported saved records.",
                },
            ],
            activateLabel: "Use Capacity Trend Q3",
            removeLabel: "Remove Capacity Trend Q3",
        },
    ],
    clearAllLabel: "Clear imported report files",
});

const importedSavedViewOverlayPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedView::saved_view_capacity_q3_overlay::capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            reportId: "capacityQ3",
            documentVersion: 10,
            exportable: false,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                scope: {
                    params: [
                        {
                            id: "dateRange",
                            label: "Reporting Window",
                        },
                    ],
                },
                datasets: [
                    {
                        id: "primary",
                        request: {
                            dimensions: { eventDate: true },
                            measures: { avails: true },
                        },
                    },
                ],
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
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
        },
        {
            id: "reportBuilder.savedReportPayload::capacity_q3_base::capacityQ3",
            title: "Capacity Q3 Base",
            reportId: "capacityQ3",
            documentVersion: 9,
            exportable: false,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_base",
                reportId: "capacityQ3",
            },
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Base",
            },
        },
    ],
    activeRecordIdentity: "",
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 10,
            source: {
                kind: "reportBuilder.savedView",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
                reportId: "capacityQ3",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
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
        },
        {
            reportId: "capacityQ3",
            documentVersion: 9,
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_base",
                reportId: "capacityQ3",
            },
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Base",
            },
        },
    ],
});

assert.deepEqual(importedSavedViewOverlayPanelState.entries[0].savedViewOverlayChips, [
    "1 filter",
    "table view",
    "Base v9",
]);
assert.deepEqual(importedSavedViewOverlayPanelState.entries[0].reopenSourceResolutionChips, [
    "Base report file capacity_q3_base • capacityQ3",
]);
assert.equal(importedSavedViewOverlayPanelState.entries[0].metaChips.includes("Base v9"), true);
assert.equal(importedSavedViewOverlayPanelState.entries[0].metaChips.includes("Base report file capacity_q3_base • capacityQ3"), true);

const importedLocalSavedRecordTemplateConflictPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::templated_conflict::capacityTrendImported",
            title: "Capacity Trend Imported",
            reportId: "capacityTrendImported",
            documentVersion: 6,
            exportable: false,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(importedLocalSavedRecordTemplateConflictPanelState.metaChips.includes("template mismatch"), true);
assert.equal(importedLocalSavedRecordTemplateConflictPanelState.entries[0].metaChips.includes("template mismatch"), true);
assert.equal(importedLocalSavedRecordTemplateConflictPanelState.entries[0].notice.level, "warning");
assert.match(
    importedLocalSavedRecordTemplateConflictPanelState.entries[0].notice.message,
    /Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief\./,
);

const importedAudienceSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_capacity_audience_segment_index_q3::capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.savedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.savedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.savedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticSummary: audienceArtifactFixture.savedReportPayload.reportSpec.semanticSummary,
            binding: audienceArtifactFixture.savedReportPayload.reportSpec.binding,
            scopeParams: audienceArtifactFixture.savedReportPayload.reportSpec.scope.params,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(importedAudienceSavedRecordPanelState.entries.length, 1);
assert.equal(importedAudienceSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudienceSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(
    importedAudienceSavedRecordPanelState.entries[0].semanticBindingFieldGroups[1].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment.index"),
    true,
);
assert.equal(
    importedAudienceSavedRecordPanelState.entries[0].semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    true,
);
assert.equal(importedAudienceSavedRecordPanelState.entries[0].scopeSummaryText, "Date Range • Channels • Audience Segment");

const importedAudienceLegacyReopenablePanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "getReportDocumentResponse::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.legacyGetReportDocumentResponse.document.title,
            reportId: audienceArtifactFixture.legacyGetReportDocumentResponse.reportRef.reportId,
            documentVersion: audienceArtifactFixture.legacyGetReportDocumentResponse.documentVersion,
            importedArtifactKind: "getReportDocumentResponse",
            document: audienceArtifactFixture.legacyGetReportDocumentResponse.document,
            reportSpec: audienceArtifactFixture.legacyGetReportDocumentResponse.reportSpec || null,
        },
    ],
    activeResponseIdentity: "",
});
assert.equal(importedAudienceLegacyReopenablePanelState.entries.length, 1);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(
    importedAudienceLegacyReopenablePanelState.entries[0].semanticBindingFieldGroups[1].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment.index"),
    true,
);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].authoredBlockCount, 4);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].drillHierarchyCount, 2);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].detailTargetCount, 2);
assert.equal(importedAudienceLegacyReopenablePanelState.entries[0].drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");

const importedAudienceLegacySavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::legacy_capacity_audience_segment_index_q3::capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.legacySavedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.legacySavedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.legacySavedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            savedReportPayload: audienceArtifactFixture.legacySavedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(importedAudienceLegacySavedRecordPanelState.entries.length, 1);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(
    importedAudienceLegacySavedRecordPanelState.entries[0].semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    true,
);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].authoredBlockCount, 4);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].drillHierarchyCount, 2);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].detailTargetCount, 2);
assert.equal(importedAudienceLegacySavedRecordPanelState.entries[0].drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");

const importedDetailTargetReopenablePanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "getReportDocumentResponse::importedDetailTargetModalDemo",
            title: detailTargetImportedPayload.reportDocument.title,
            reportId: detailTargetImportedPayload.reportDocument.id,
            documentVersion: 21,
            importedArtifactKind: "getReportDocumentResponse",
            document: detailTargetImportedPayload.reportDocument,
            reportSpec: detailTargetImportedPayload.reportSpec,
        },
    ],
    activeResponseIdentity: "",
});
assert.equal(importedDetailTargetReopenablePanelState.entries.length, 1);
assert.equal(importedDetailTargetReopenablePanelState.entries[0].semanticBindingChips.includes("Measures Avails"), true);
assert.equal(importedDetailTargetReopenablePanelState.entries[0].semanticBindingChips.includes("Dimensions Event Date, Channel"), true);
assert.equal(importedDetailTargetReopenablePanelState.entries[0].detailTargetCount, 1);
assert.equal(importedDetailTargetReopenablePanelState.entries[0].drillSummaryText, "0 drill hierarchies • 0 levels • 1 detail target • 1 field action");

const importedDetailTargetSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::rbreport_imported_detail_target_modal::imported_detail_target_modal_demo::importedDetailTargetModalDemo",
            title: detailTargetImportedPayload.reportDocument.title,
            reportId: detailTargetImportedPayload.reportDocument.id,
            documentVersion: 21,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            savedReportPayload: detailTargetImportedPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(importedDetailTargetSavedRecordPanelState.entries.length, 1);
assert.equal(importedDetailTargetSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Avails"), true);
assert.equal(importedDetailTargetSavedRecordPanelState.entries[0].semanticBindingChips.includes("Dimensions Event Date, Channel"), true);
assert.equal(importedDetailTargetSavedRecordPanelState.entries[0].detailTargetCount, 1);
assert.equal(importedDetailTargetSavedRecordPanelState.entries[0].drillSummaryText, "0 drill hierarchies • 0 levels • 1 detail target • 1 field action");

const importedDetailTargetSharedArtifactPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedView::saved_view_imported_detail_target_modal::importedDetailTargetModalDemo",
            title: detailTargetImportedSharedArtifacts.savedViewArtifact.title,
            reportId: detailTargetImportedSharedArtifacts.savedViewArtifact.reportId,
            documentVersion: detailTargetImportedSharedArtifacts.savedViewArtifact.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedView",
            document: detailTargetImportedSharedArtifacts.savedViewArtifact.document,
            reportSpec: detailTargetImportedSharedArtifacts.savedViewArtifact.reportSpec,
        },
        {
            id: "reportBuilder.publishedSnapshot::published_snapshot_imported_detail_target_modal::importedDetailTargetModalDemo",
            title: detailTargetImportedSharedArtifacts.publishedSnapshotArtifact.title,
            reportId: detailTargetImportedSharedArtifacts.publishedSnapshotArtifact.reportId,
            documentVersion: detailTargetImportedSharedArtifacts.publishedSnapshotArtifact.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: detailTargetImportedSharedArtifacts.publishedSnapshotArtifact.document,
            reportSpec: detailTargetImportedSharedArtifacts.publishedSnapshotArtifact.reportSpec,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(importedDetailTargetSharedArtifactPanelState.entries.length, 2);
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[0].detailTargetCount, 1);
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[0].drillSummaryText, "0 drill hierarchies • 0 levels • 1 detail target • 1 field action");
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[0].metaChips.includes("saved-view artifact"), true);
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[1].detailTargetCount, 1);
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[1].drillSummaryText, "0 drill hierarchies • 0 levels • 1 detail target • 1 field action");
assert.equal(importedDetailTargetSharedArtifactPanelState.entries[1].metaChips.includes("published-snapshot artifact"), true);

const structurallyThinAudienceSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::thin_capacity_audience_segment_index_q3::capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.legacySavedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.legacySavedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.legacySavedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            reportSpec: {
                kind: "reportSpec",
                semanticSummary: {
                    kind: "semantic",
                    selectedDimensions: [],
                    selectedMeasures: [],
                    selectedParameters: [],
                },
                scope: {
                    params: [],
                },
            },
            savedReportPayload: audienceArtifactFixture.legacySavedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries.length, 1);
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(
    structurallyThinAudienceSavedRecordPanelState.entries[0].semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    true,
);
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries[0].scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries[0].authoredBlockCount, 4);
assert.equal(structurallyThinAudienceSavedRecordPanelState.entries[0].drillHierarchyCount, 2);

const carriedImportedReopenablePanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "getReportDocumentResponse::carriedImportedDeliveryTrend",
            title: "Carried Imported Delivery Trend",
            reportId: "carriedImportedDeliveryTrend",
            documentVersion: 3,
            importedArtifactKind: "getReportDocumentResponse",
            semanticBindingViewState: {
                title: "Semantic Binding",
                chips: [
                    "Model Carry Delivery",
                    "Measures Carry Impressions",
                ],
                fieldGroups: [
                    {
                        id: "measures",
                        title: "Selected measures (1)",
                        fields: [
                            {
                                id: "carry_impressions",
                                label: "Carry Impressions",
                                definitionRef: "harmonizer://feature/carry.impressions",
                            },
                        ],
                    },
                ],
            },
            reportSpec: {
                kind: "reportSpec",
                semanticSummary: {
                    kind: "semantic",
                    selectedDimensions: [],
                    selectedMeasures: [],
                    selectedParameters: [],
                },
                scope: {
                    params: [],
                },
            },
        },
    ],
    activeResponseIdentity: "",
});
assert.equal(carriedImportedReopenablePanelState.entries[0].semanticBindingChips.includes("Measures Carry Impressions"), true);
assert.equal(
    carriedImportedReopenablePanelState.entries[0].semanticBindingFieldGroups[0].fields[0].definitionRef,
    "harmonizer://feature/carry.impressions",
);

const carriedImportedSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::carried_imported_delivery_trend::carriedImportedDeliveryTrend",
            title: "Carried Imported Delivery Trend",
            reportId: "carriedImportedDeliveryTrend",
            documentVersion: 3,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                semanticBindingViewState: {
                    title: "Semantic Binding",
                    chips: [
                        "Model Carry Delivery",
                        "Measures Carry Impressions",
                    ],
                    fieldGroups: [
                        {
                            id: "measures",
                            title: "Selected measures (1)",
                            fields: [
                                {
                                    id: "carry_impressions",
                                    label: "Carry Impressions",
                                    definitionRef: "harmonizer://feature/carry.impressions",
                                },
                            ],
                        },
                    ],
                },
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "carriedImportedDeliveryTrend",
                    title: "Carried Imported Delivery Trend",
                },
                reportSpec: {
                    kind: "reportSpec",
                    semanticSummary: {
                        kind: "semantic",
                        selectedDimensions: [],
                        selectedMeasures: [],
                        selectedParameters: [],
                    },
                    scope: {
                        params: [],
                    },
                },
            },
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(carriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Carry Impressions"), true);
assert.equal(
    carriedImportedSavedRecordPanelState.entries[0].semanticBindingFieldGroups[0].fields[0].definitionRef,
    "harmonizer://feature/carry.impressions",
);

const emptyCarriedImportedSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::empty_carried_capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.savedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.savedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.savedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticBindingViewState: {},
            savedReportPayload: audienceArtifactFixture.savedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(emptyCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(emptyCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);

const titleOnlyCarriedImportedSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::title_only_carried_capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.savedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.savedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.savedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticBindingViewState: {
                title: "Semantic Binding",
            },
            savedReportPayload: audienceArtifactFixture.savedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(titleOnlyCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(titleOnlyCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);

const malformedFieldGroupCarriedImportedSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::malformed_field_group_carried_capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.savedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.savedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.savedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticBindingViewState: {
                fieldGroups: [{}],
            },
            savedReportPayload: audienceArtifactFixture.savedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(malformedFieldGroupCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(malformedFieldGroupCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);

const anonymousFieldGroupCarriedImportedSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::anonymous_field_group_carried_capacity_audience_segment_index_q3::capacityAudienceSegmentIndexQ3",
            title: audienceArtifactFixture.savedReportPayload.reportDocument.title,
            reportId: audienceArtifactFixture.savedReportPayload.reportDocument.id,
            documentVersion: audienceArtifactFixture.savedReportRecord.documentVersion,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticBindingViewState: {
                fieldGroups: [
                    {
                        fields: [
                            {
                                label: "Carried Measure",
                            },
                        ],
                    },
                ],
            },
            savedReportPayload: audienceArtifactFixture.savedReportRecord.savedReportPayload,
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(anonymousFieldGroupCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(anonymousFieldGroupCarriedImportedSavedRecordPanelState.entries[0].semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);

const canonicalMetadataPreferredReopenablePanelState = buildImportedLocalReopenablePanelState({
    importedLocalGetReportDocumentResponses: [
        {
            id: "getReportDocumentResponse::canonicalImportedDeliveryTrend",
            title: "Canonical Imported Delivery Trend",
            reportId: "canonicalImportedDeliveryTrend",
            documentVersion: 7,
            importedArtifactKind: "getReportDocumentResponse",
            semanticBindingViewState: {
                title: "Semantic Binding",
                chips: [
                    "Model model://example/performance/delivery@v1",
                    "Entity line_delivery",
                    "Dimensions event_date",
                    "Measures available_impressions",
                ],
                fieldGroups: [
                    {
                        id: "dimensions",
                        title: "Selected dimensions (1)",
                        fields: [
                            { id: "event_date", rawId: "event_date", label: "event_date" },
                        ],
                    },
                    {
                        id: "measures",
                        title: "Selected measures (1)",
                        fields: [
                            { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
                        ],
                    },
                ],
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                semanticSummary: {
                    kind: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date"],
                    selectedMeasures: ["available_impressions"],
                },
            },
            document: {
                version: 1,
                kind: "reportDocument",
                id: "canonicalImportedDeliveryTrend",
                title: "Canonical Imported Delivery Trend",
                semanticSummary: {
                    kind: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    modelLabel: "Canonical Ad Delivery",
                    entity: "line_delivery",
                    entityLabel: "Canonical Line Delivery",
                    selectedDimensions: [
                        { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date", category: "Time" },
                    ],
                    selectedMeasures: [
                        { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                    ],
                },
            },
        },
    ],
    activeResponseIdentity: "",
});
assert.equal(canonicalMetadataPreferredReopenablePanelState.entries[0].semanticBindingChips.includes("Model Canonical Ad Delivery"), true);
assert.equal(canonicalMetadataPreferredReopenablePanelState.entries[0].semanticBindingChips.includes("Entity Canonical Line Delivery"), true);
assert.equal(canonicalMetadataPreferredReopenablePanelState.entries[0].semanticBindingChips.includes("Dimensions Canonical Delivery Date"), true);
assert.equal(canonicalMetadataPreferredReopenablePanelState.entries[0].semanticBindingChips.includes("Measures Canonical Available Impressions"), true);

const canonicalMetadataPreferredSavedRecordPanelState = buildImportedLocalSavedRecordPanelState({
    importedLocalSavedReportRecords: [
        {
            id: "reportBuilder.savedReportPayload::canonical_imported_delivery_trend::canonicalImportedDeliveryTrend",
            title: "Canonical Imported Delivery Trend",
            reportId: "canonicalImportedDeliveryTrend",
            documentVersion: 7,
            exportable: true,
            importedArtifactKind: "reportBuilder.savedReportRecord",
            semanticBindingViewState: {
                title: "Semantic Binding",
                chips: [
                    "Model model://example/performance/delivery@v1",
                    "Entity line_delivery",
                    "Dimensions event_date",
                    "Measures available_impressions",
                ],
                fieldGroups: [
                    {
                        id: "dimensions",
                        title: "Selected dimensions (1)",
                        fields: [
                            { id: "event_date", rawId: "event_date", label: "event_date" },
                        ],
                    },
                    {
                        id: "measures",
                        title: "Selected measures (1)",
                        fields: [
                            { id: "available_impressions", rawId: "available_impressions", label: "available_impressions" },
                        ],
                    },
                ],
            },
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "canonicalImportedDeliveryTrend",
                    title: "Canonical Imported Delivery Trend",
                    semanticSummary: {
                        kind: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        modelLabel: "Canonical Ad Delivery",
                        entity: "line_delivery",
                        entityLabel: "Canonical Line Delivery",
                        selectedDimensions: [
                            { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date", category: "Time" },
                        ],
                        selectedMeasures: [
                            { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                        ],
                    },
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["available_impressions"],
                    },
                },
                reportSpec: {
                    version: 1,
                    kind: "reportSpec",
                    semanticSummary: {
                        kind: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["available_impressions"],
                    },
                },
            },
        },
    ],
    activeRecordIdentity: "",
});
assert.equal(canonicalMetadataPreferredSavedRecordPanelState.entries[0].semanticBindingChips.includes("Model Canonical Ad Delivery"), true);
assert.equal(canonicalMetadataPreferredSavedRecordPanelState.entries[0].semanticBindingChips.includes("Entity Canonical Line Delivery"), true);
assert.equal(canonicalMetadataPreferredSavedRecordPanelState.entries[0].semanticBindingChips.includes("Dimensions Canonical Delivery Date"), true);
assert.equal(canonicalMetadataPreferredSavedRecordPanelState.entries[0].semanticBindingChips.includes("Measures Canonical Available Impressions"), true);

const runtimePanelState = buildImportedPipelinePreviewPanelState({
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
        fileName: "capacity-trend.report-spec.json",
        blockCount: 6,
        datasetCount: 1,
    },
    importedPipelineRuntimeArtifact: {
        runtimeBlock: {
            subtitle: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
        },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Reporting Window",
                        description: "Approved reporting window for imported runtime preview.",
                    },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
            },
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                    { id: "channel", rawId: "channelV2", label: "Channel" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
        },
        reportFill: { kind: "reportFill" },
    },
    importedPipelineRuntimeFillSummary: {
        rowCount: 8,
        attached: true,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: true,
        message: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
    },
    importedPipelineInspectorSection: "reportFill",
});

assert.deepEqual(runtimePanelState, {
    eyebrow: "Imported Runtime",
    title: "Capacity Trend Q3",
    description: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
    summaryLabel: "Imported ReportSpec",
    summaryValue: "Capacity Trend Q3",
    summaryTitle: "Imported ReportSpec: Capacity Trend Q3",
    sourceFileLine: "Source file: capacity-trend.report-spec.json",
    compatibilityMessage: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    metaChips: ["6 blocks", "1 dataset", "8 filled rows", "Attached ReportFill"],
    attachAction: {
        mode: "detach",
        label: "Detach ReportFill",
        disabled: false,
    },
    inspectActions: [
        { section: "reportSpec", label: "Inspect ReportSpec", active: false },
        { section: "reportFill", label: "Hide ReportFill", active: true },
        { section: "reportPrint", label: "Inspect ReportPrint", active: false },
    ],
    hideLabel: "Hide imported runtime",
});

const conflictingRuntimePanelState = buildImportedPipelinePreviewPanelState({
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
        fileName: "capacity-trend.report-spec.json",
        blockCount: 6,
        datasetCount: 1,
    },
    importedPipelineRuntimeArtifact: {
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendQ3",
            title: "Capacity Trend Q3",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            blocks: [
                {
                    id: "primaryBuilder",
                    kind: "reportBuilderBlock",
                    state: {
                        reportDocumentTemplateId: "capacity_inventory_brief",
                        reportDocumentTemplateLabel: "Capacity Inventory Brief",
                    },
                },
            ],
        },
        runtimeBlock: {
            subtitle: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
        },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
        },
        reportFill: { kind: "reportFill" },
    },
    importedPipelineRuntimeFillSummary: {
        rowCount: 8,
        attached: true,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: true,
        message: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
    },
    importedPipelineInspectorSection: "",
});
assert.equal(conflictingRuntimePanelState.templateConflict, true);
assert.equal(conflictingRuntimePanelState.templateConflictLabel, "template mismatch");
assert.equal(conflictingRuntimePanelState.templateLabel, "Market Brief");
assert.equal(conflictingRuntimePanelState.summaryNotice?.tone, "warning");
assert.equal(conflictingRuntimePanelState.summaryNotice?.templateLabel, "Market Brief");
assert.equal(conflictingRuntimePanelState.metaChips.includes("Market Brief"), true);
assert.equal(conflictingRuntimePanelState.metaChips.includes("template mismatch"), true);
assert.match(
    conflictingRuntimePanelState.templateConflictMessage,
    /Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief\./,
);

const importedAudienceRuntimePanelStateWithEmptySpec = buildImportedPipelinePreviewPanelState({
    importedPipelineSummary: {
        title: "Capacity Audience Segment Index Q3",
        fileName: "capacity-audience.report-spec.json",
        blockCount: 5,
        datasetCount: 1,
    },
    importedPipelinePreview: {
        payload: audienceArtifactFixture.savedReportPayload.reportSpec,
    },
    importedPipelineRuntimeArtifact: {
        document: audienceArtifactFixture.savedReportPayload.reportDocument,
        runtimeBlock: {
            subtitle: "Local runtime preview compiled from the imported ReportSpec and attached ReportFill artifacts.",
        },
        reportFill: audienceArtifactFixture.reportExportRequest.reportFill,
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            scope: {
                params: [],
            },
        },
        reportFill: audienceArtifactFixture.reportExportRequest.reportFill,
    },
    importedPipelineRuntimeFillSummary: {
        rowCount: 8,
        attached: false,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: false,
        message: "Imported ReportFill matches the imported ReportSpec by specVersion and specHash. Attach it explicitly to use real filled rows.",
    },
    importedPipelineInspectorSection: "",
});
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.authoredBlockCount, 4);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.drillHierarchyCount, 2);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.detailTargetCount, 2);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.metaChips.includes("4 authored blocks"), true);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.metaChips.includes("2 drill hierarchies"), true);
assert.equal(importedAudienceRuntimePanelStateWithEmptySpec.metaChips.includes("2 detail targets"), true);

const previewOnlyRuntimePanelState = buildImportedPipelinePreviewPanelState({
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
        fileName: "",
        blockCount: 6,
        datasetCount: 1,
    },
    importedPipelineRuntimeArtifact: {
        runtimeBlock: {},
    },
    importedPipelineRuntimeConfig: {
        reportSpec: { kind: "reportSpec" },
        reportFill: { kind: "reportFill" },
    },
    importedPipelineRuntimeFillSummary: {
        rowCount: 0,
        attached: false,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: false,
        message: "Imported ReportFill matches the imported ReportSpec by specVersion and specHash. Attach it explicitly to use real filled rows.",
    },
    importedPipelineInspectorSection: "",
});

assert.deepEqual(previewOnlyRuntimePanelState.attachAction, {
    mode: "attach",
    label: "Attach ReportFill",
    disabled: false,
});
assert.deepEqual(previewOnlyRuntimePanelState.metaChips, ["6 blocks", "1 dataset", "Preview Fill"]);

const carriedRuntimeSemanticBindingViewState = {
    title: "Semantic Binding",
    chips: [
        "Model Config Carry Delivery",
        "Measures Config Carry Impressions",
    ],
    fieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "config_carry_impressions",
                    label: "Config Carry Impressions",
                    definitionRef: "harmonizer://feature/config.carry.impressions",
                },
            ],
        },
    ],
};

const carriedRuntimePanelState = buildImportedPipelinePreviewPanelState({
    importedPipelineSummary: {
        title: "Carried Runtime Preview",
        fileName: "carried-runtime-preview.report-spec.json",
        blockCount: 1,
        datasetCount: 1,
    },
    importedPipelineRuntimeArtifact: {
        runtimeBlock: {
            subtitle: "Local runtime preview compiled from carried semantic state.",
            dashboard: {
                reportRuntime: {
                    semanticBindingViewState: {
                        title: "Semantic Binding",
                        chips: [
                            "Model Artifact Carry Delivery",
                            "Measures Artifact Carry Impressions",
                        ],
                    },
                },
            },
        },
        reportFill: { kind: "reportFill" },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
            semanticSummary: {
                kind: "semantic",
                selectedDimensions: [],
                selectedMeasures: [],
                selectedParameters: [],
            },
            scope: {
                params: [],
            },
        },
        semanticBindingViewState: carriedRuntimeSemanticBindingViewState,
    },
    importedPipelineRuntimeFillSummary: {
        rowCount: 4,
        attached: true,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: true,
        message: "Imported ReportFill is attached to the imported ReportSpec runtime preview.",
    },
    importedPipelineInspectorSection: "reportSpec",
});
assert.equal(carriedRuntimePanelState.semanticBindingChips.includes("Measures Config Carry Impressions"), true);
assert.equal(carriedRuntimePanelState.semanticBindingChips.includes("Measures Artifact Carry Impressions"), false);
assert.equal(
    carriedRuntimePanelState.semanticBindingFieldGroups[0].fields[0].definitionRef,
    "harmonizer://feature/config.carry.impressions",
);

const importedPipelineInspectorState = buildImportedPipelineInspectorState({
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
        fileName: "capacity-trend.report-spec.json",
    },
    importedPipelinePreview: {
        payload: {
            kind: "reportSpec",
            title: "Capacity Trend Q3",
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Reporting Window",
                        description: "Approved reporting window for imported runtime preview.",
                    },
                ],
            },
        },
    },
    importedPipelineRuntimeArtifact: {
        reportFill: {
            kind: "reportFill",
            blocks: [{ id: "block-1" }],
        },
        reportPrint: {
            kind: "reportPrint",
            pages: [{ id: "page-1" }],
        },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
            scope: {
                params: [
                    {
                        id: "dateRange",
                        label: "Reporting Window",
                        description: "Approved reporting window for imported runtime preview.",
                    },
                ],
            },
            binding: {
                mode: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                entity: "line_delivery",
            },
            semanticSummary: {
                kind: "semantic",
                modelRef: "model://example/performance/delivery@v1",
                modelLabel: "Ad Delivery",
                entity: "line_delivery",
                entityLabel: "Line Delivery",
                selectedDimensions: [
                    { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                    { id: "channel", rawId: "channelV2", label: "Channel" },
                ],
                selectedMeasures: [
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                ],
            },
        },
    },
    importedPipelineInspectorSection: "reportFill",
});

assert.deepEqual(importedPipelineInspectorState, {
    title: "Capacity Trend Q3",
    section: "reportFill",
    label: "ReportFill",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    content: JSON.stringify({
        kind: "reportFill",
        blocks: [{ id: "block-1" }],
    }, null, 2),
});

const carriedRuntimeInspectorState = buildImportedPipelineInspectorState({
    importedPipelineSummary: {
        title: "Carried Runtime Preview",
        fileName: "carried-runtime-preview.report-spec.json",
    },
    importedPipelineRuntimeArtifact: {
        runtimeBlock: {
            dashboard: {
                reportRuntime: {
                    semanticBindingViewState: {
                        title: "Semantic Binding",
                        chips: [
                            "Model Artifact Carry Delivery",
                            "Measures Artifact Carry Impressions",
                        ],
                    },
                },
            },
        },
        reportFill: { kind: "reportFill", blocks: [] },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
            semanticSummary: {
                kind: "semantic",
                selectedDimensions: [],
                selectedMeasures: [],
                selectedParameters: [],
            },
            scope: {
                params: [],
            },
        },
        semanticBindingViewState: carriedRuntimeSemanticBindingViewState,
    },
    importedPipelineInspectorSection: "reportFill",
});
assert.equal(carriedRuntimeInspectorState.semanticBindingChips.includes("Measures Config Carry Impressions"), true);
assert.equal(carriedRuntimeInspectorState.semanticBindingChips.includes("Measures Artifact Carry Impressions"), false);
assert.equal(
    carriedRuntimeInspectorState.semanticBindingFieldGroups[0].fields[0].definitionRef,
    "harmonizer://feature/config.carry.impressions",
);

assert.deepEqual(buildImportedPipelineInspectorState({
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
    },
    importedPipelinePreview: {
        payload: {
            kind: "reportSpec",
            title: "Capacity Trend Q3",
        },
    },
    importedPipelineRuntimeArtifact: {
        reportFill: {
            kind: "reportFill",
        },
        reportPrint: {
            kind: "reportPrint",
        },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
        },
    },
    importedPipelineInspectorSection: "reportSpec",
}), {
    title: "Capacity Trend Q3",
    section: "reportSpec",
    label: "ReportSpec",
    content: JSON.stringify({
        kind: "reportSpec",
        title: "Capacity Trend Q3",
    }, null, 2),
});

const importedAudiencePipelineInspectorStateWithEmptySpec = buildImportedPipelineInspectorState({
    importedPipelineSummary: {
        title: "Capacity Audience Segment Index Q3",
    },
    importedPipelinePreview: {
        payload: audienceArtifactFixture.savedReportPayload.reportSpec,
    },
    importedPipelineRuntimeArtifact: {
        document: audienceArtifactFixture.savedReportPayload.reportDocument,
        reportFill: {
            kind: "reportFill",
            blocks: [{ id: "block-1" }],
        },
    },
    importedPipelineRuntimeConfig: {
        reportSpec: {
            kind: "reportSpec",
            scope: {
                params: [],
            },
        },
    },
    importedPipelineInspectorSection: "reportFill",
});
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.authoredBlockCount, 4);
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.drillHierarchyCount, 2);
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.detailTargetCount, 2);
assert.equal(importedAudiencePipelineInspectorStateWithEmptySpec.drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");

const importedFillPanelState = buildImportedStandaloneReportFillPanelState({
    importedStandaloneReportFillSummary: {
        title: "capacity-trend.report-fill",
        datasetCount: 1,
        blockCount: 6,
        rowCount: 8,
        diagnosticCount: 0,
        specVersion: 1,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: false,
        attached: false,
        message: "Imported ReportFill does not match the current imported ReportSpec (hash mismatch (deadbeef vs d14909e1)).",
    },
    importedStandaloneReportFillOpen: false,
    companionReportSpec: {
        kind: "reportSpec",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported runtime preview.",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
});

assert.deepEqual(importedFillPanelState, {
    summaryLabel: "Imported ReportFill",
    summaryValue: "capacity-trend.report-fill",
    title: "Imported ReportFill: capacity-trend.report-fill",
    description: "Canonical filled-data contract imported locally. Inspect or download the JSON artifact directly.",
    compatibilityMessage: "Imported ReportFill does not match the current imported ReportSpec (hash mismatch (deadbeef vs d14909e1)).",
    metaChips: ["1 dataset", "6 blocks", "8 rows", "spec v1"],
    attachAction: {
        mode: "attach",
        label: "Attach to ReportSpec",
        disabled: true,
    },
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    inspectLabel: "Inspect ReportFill",
    downloadLabel: "Download ReportFill",
    hideLabel: "Hide imported fill",
});

const conflictingImportedFillPanelState = buildImportedStandaloneReportFillPanelState({
    importedStandaloneReportFillSummary: {
        title: "capacity-trend.report-fill",
        datasetCount: 1,
        blockCount: 6,
        rowCount: 8,
        diagnosticCount: 0,
        specVersion: 1,
    },
    importedPipelineCompanionFillCompatibility: {
        available: true,
        compatible: true,
        attached: false,
        message: "",
    },
    companionReportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_inventory_brief",
                    reportDocumentTemplateLabel: "Capacity Inventory Brief",
                },
            },
        ],
    },
});
assert.equal(conflictingImportedFillPanelState.templateConflict, true);
assert.equal(conflictingImportedFillPanelState.templateLabel, "Market Brief");
assert.equal(conflictingImportedFillPanelState.summaryNotice?.tone, "warning");
assert.equal(conflictingImportedFillPanelState.summaryNotice?.templateLabel, "Market Brief");
assert.equal(conflictingImportedFillPanelState.metaChips.includes("Market Brief"), true);
assert.equal(conflictingImportedFillPanelState.metaChips.includes("template mismatch"), true);


assert.deepEqual(buildImportedStandaloneReportFillInspectorState({
    importedStandaloneReportFillSummary: {
        title: "capacity-trend.report-fill",
        rowCount: 8,
    },
    importedStandaloneReportFillOpen: true,
    companionReportSpec: {
        kind: "reportSpec",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported runtime preview.",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
}), {
    expandedMetaChips: ["ReportFill", "capacity-trend.report-fill", "8 rows"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    inspectLabel: "Hide ReportFill",
    downloadLabel: "Download ReportFill",
});

const importedPrintPanelState = buildImportedStandaloneReportPrintPanelState({
    importedStandaloneReportPrintSummary: {
        title: "Capacity Trend Q3",
        pageCount: 3,
        bookmarkCount: 5,
        diagnosticCount: 0,
        pageWidth: 792,
        pageHeight: 612,
    },
    importedStandaloneReportPrintOpen: true,
    companionReportSpec: {
        kind: "reportSpec",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported runtime preview.",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
});

assert.deepEqual(importedPrintPanelState, {
    summaryLabel: "Imported ReportPrint",
    summaryValue: "Capacity Trend Q3",
    description: "Canonical print-layout contract imported locally. Inspect or download the JSON artifact directly.",
    metaChips: ["3 pages", "5 bookmarks", "792 x 612"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    inspectLabel: "Hide ReportPrint",
    downloadLabel: "Download ReportPrint",
    hideLabel: "Hide imported print",
    expandedMetaChips: ["ReportPrint", "Capacity Trend Q3", "3 pages"],
});

const conflictingImportedPrintInspectorState = buildImportedStandaloneReportPrintInspectorState({
    importedStandaloneReportPrintSummary: {
        title: "Capacity Trend Q3",
        pageCount: 3,
    },
    importedStandaloneReportPrintOpen: true,
    companionReportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_inventory_brief",
                    reportDocumentTemplateLabel: "Capacity Inventory Brief",
                },
            },
        ],
    },
});
assert.equal(conflictingImportedPrintInspectorState.templateConflict, true);
assert.equal(conflictingImportedPrintInspectorState.expandedMetaChips.includes("Market Brief"), true);
assert.equal(conflictingImportedPrintInspectorState.expandedMetaChips.includes("template mismatch"), true);

const importedAudiencePrintPanelState = buildImportedStandaloneReportPrintPanelState({
    importedStandaloneReportPrintSummary: {
        title: audienceArtifactFixture.pdfReportPrint.title,
        pageCount: audienceArtifactFixture.pdfReportPrint.pages.length,
        bookmarkCount: audienceArtifactFixture.pdfReportPrint.bookmarks.length,
        pageWidth: audienceArtifactFixture.pdfReportPrint.pageGeometry.width,
        pageHeight: audienceArtifactFixture.pdfReportPrint.pageGeometry.height,
    },
    importedStandaloneReportPrintOpen: false,
    companionReportSpec: audienceArtifactFixture.savedReportPayload.reportSpec,
});
assert.equal(importedAudiencePrintPanelState.summaryLabel, "Imported ReportPrint");
assert.equal(importedAudiencePrintPanelState.summaryValue, "Capacity Audience Segment Index Q3");
assert.equal(importedAudiencePrintPanelState.metaChips.includes("2 pages"), true);
assert.equal(importedAudiencePrintPanelState.metaChips.includes("4 bookmarks"), true);
assert.equal(importedAudiencePrintPanelState.metaChips.includes("792 x 612"), true);
assert.equal(importedAudiencePrintPanelState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudiencePrintPanelState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(importedAudiencePrintPanelState.semanticBindingChips.includes("Categories Location, Audience +1"), true);
assert.equal(importedAudiencePrintPanelState.semanticBindingChips.includes("Lineage harmonizer://feature/location +2"), true);
assert.equal(importedAudiencePrintPanelState.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(importedAudiencePrintPanelState.expandedMetaChips.includes("ReportPrint"), true);

assert.deepEqual(buildImportedStandaloneReportPrintInspectorState({
    importedStandaloneReportPrintSummary: {
        title: "Capacity Trend Q3",
        pageCount: 3,
    },
    importedStandaloneReportPrintOpen: true,
    companionReportSpec: {
        kind: "reportSpec",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for imported runtime preview.",
                },
            ],
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
}), {
    expandedMetaChips: ["ReportPrint", "Capacity Trend Q3", "3 pages"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
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
            description: "Approved reporting window for imported runtime preview.",
        },
    ],
    inspectLabel: "Hide ReportPrint",
    downloadLabel: "Download ReportPrint",
});

const importedExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: {
        title: "Capacity Trend Q3",
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        documentVersion: 6,
        hasReportPrint: true,
        reopenSourceResolutionTitle: "Resolved Reopen Sources",
        reopenSourceResolutionText: "Resolved reopen against the base report file.",
        reopenSourceResolutionChips: ["Base report file capacity_trend_q3_base • capacityTrendQ3"],
        reopenSourceResolutionSources: [
            {
                id: "baseReport",
                label: "Base report file",
                value: "capacity_trend_q3_base • capacityTrendQ3",
                source: {
                    kind: "reportBuilder.savedReportPayload",
                    sourceArtifactId: "capacity_trend_q3_base",
                    reportId: "capacityTrendQ3",
                },
            },
        ],
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
                description: "Approved reporting window for imported export review.",
            },
        ],
    },
});

assert.deepEqual(importedExportRequestPanelState, {
    summaryLabel: "Imported export request",
    summaryValue: "Capacity Trend Q3",
    description: "Source: savedPayload • Format: PDF",
    metaChips: [
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "v6",
        "Base report file capacity_trend_q3_base • capacityTrendQ3",
        "Model Ad Delivery",
        "Entity Line Delivery",
    ],
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
            description: "Approved reporting window for imported export review.",
        },
    ],
    reopenSourceResolutionTitle: "Resolved Reopen Sources",
    reopenSourceResolutionText: "Resolved reopen against the base report file.",
    reopenSourceResolutionChips: ["Base report file capacity_trend_q3_base • capacityTrendQ3"],
    reopenSourceResolutionSources: [
        {
            id: "baseReport",
            label: "Base report file",
            value: "capacity_trend_q3_base • capacityTrendQ3",
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_trend_q3_base",
                reportId: "capacityTrendQ3",
            },
        },
    ],
    downloadLabel: "Download export request",
    hideLabel: "Hide imported request",
    expandedMetaChips: [
        "savedPayload",
        "PDF",
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "ReportPrint",
        "Base report file capacity_trend_q3_base • capacityTrendQ3",
        "Model Ad Delivery",
        "Entity Line Delivery",
    ],
});

const importedExportRequestReviewOnlyPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: {
        title: "Capacity Trend Q3",
        from: "draft",
        format: "PDF",
        artifactRef: "dashboard.reportBuilder://demoReportBuilder",
        documentVersion: 0,
        hasReportPrint: false,
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
                description: "Approved reporting window for imported export review.",
            },
        ],
    },
});

assert.deepEqual(importedExportRequestReviewOnlyPanelState.metaChips, ["dashboard.reportBuilder://demoReportBuilder", "Model Ad Delivery"]);
assert.equal(importedExportRequestReviewOnlyPanelState.downloadLabel, "Download export request");

const conflictingImportedExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: {
        title: "Capacity Trend Q3",
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        documentVersion: 6,
        hasReportPrint: true,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
});
assert.deepEqual(conflictingImportedExportRequestPanelState, {
    summaryLabel: "Imported export request",
    summaryValue: "Capacity Trend Q3",
    description: "Source: savedPayload • Format: PDF",
    metaChips: [
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "v6",
        "Market Brief",
        "template mismatch",
        "Model Ad Delivery",
    ],
    templateId: "market_brief",
    templateLabel: "Market Brief",
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    summaryNotice: {
        tone: "warning",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    },
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    downloadLabel: "Download export request",
    hideLabel: "Hide imported request",
    expandedMetaChips: [
        "savedPayload",
        "PDF",
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "Market Brief",
        "template mismatch",
        "ReportPrint",
        "Model Ad Delivery",
    ],
});

assert.deepEqual(buildImportedStandaloneExportStatusMetaChips({
    executionSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        reopenSourceResolutionChips: [
            "Base report file capacity_trend_q3_base • capacityTrendQ3",
        ],
    },
    requestSummary: {
        templateLabel: "Capacity Inventory Brief",
        templateConflictLabel: "",
    },
}), ["Market Brief", "template mismatch", "Base report file capacity_trend_q3_base • capacityTrendQ3"]);

assert.deepEqual(buildImportedPipelineExportStatusMetaChips({
    requestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
    },
    runtimeFillSummary: {
        attached: false,
        rowCount: 8,
    },
}), ["Market Brief", "template mismatch", "Preview Fill", "8 rows"]);

assert.deepEqual(buildImportedStandaloneExportActionState({
    importedStandaloneExportRequestExecutionSummary: {
        title: "Capacity Trend Q3",
    },
    importedStandaloneExportRequestOpen: false,
    importedStandaloneExportSubmitting: true,
    reportExportHandlerAvailable: true,
}), {
    submitLabel: "Export snapshot",
    submitDisabled: true,
    inspectLabel: "Inspect export",
});

assert.deepEqual(buildImportedStandaloneExportRequestDetailPanelState({
    importedStandaloneExportRequestInspector: {
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        hasReportPrint: true,
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        content: "{\"imported\":true}",
    },
    importedStandaloneExportRequestOpen: true,
}), {
    metaChips: [
        "savedPayload",
        "PDF",
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "Market Brief",
        "template mismatch",
        "reportPrint",
        "Model Ad Delivery",
    ],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    content: "{\"imported\":true}",
});

assert.deepEqual(buildImportedStandaloneExportJobPanelState({
    importedStandaloneExportJobSummary: {
        jobId: "job-standalone",
        status: "queued",
        artifactId: "",
        canRefresh: true,
        hasArtifact: false,
        hasFailure: false,
        error: "",
    },
    importedStandaloneExportRequestExecutionSummary: {
        title: "Capacity Trend Q3",
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        reopenSourceResolutionChips: [
            "Base report file capacity_trend_q3_base • capacityTrendQ3",
        ],
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    importedStandaloneExportRequestSummary: {
        title: "Capacity Trend Q3 fallback",
    },
}), {
    tone: "info",
    label: "Imported export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: ["job-standalone", "queued", "Market Brief", "template mismatch", "Base report file capacity_trend_q3_base • capacityTrendQ3"],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: false,
    downloadLabel: "Download artifact",
    downloadDisabled: true,
});

assert.deepEqual(buildImportedStandaloneExportFailureNotice({
    importedStandaloneExportJob: {
        hasFailure: true,
        jobId: "job-standalone-fail",
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
    importedStandaloneExportRequestExecutionSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        reopenSourceResolutionChips: [
            "Base report file capacity_trend_q3_base • capacityTrendQ3",
        ],
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
}), {
    title: "Imported export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: ["Market Brief", "template mismatch", "Base report file capacity_trend_q3_base • capacityTrendQ3"],
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

assert.deepEqual(buildImportedPipelineExportActionState({
    importedPipelineExportRequestSummary: {
        title: "Capacity Trend Q3",
    },
    importedPipelineExportRequestOpen: true,
    importedPipelineExportSubmitting: false,
    reportExportHandlerAvailable: false,
}), {
    submitLabel: "Review export",
    submitDisabled: false,
    inspectLabel: "Hide export",
});

assert.deepEqual(buildImportedPipelineExportRequestDetailPanelState({
    importedPipelineExportRequestInspector: {
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        templateLabel: "Market Brief",
        hasReportPrint: true,
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
        content: "{\"pipeline\":true}",
    },
    importedPipelineExportRequestOpen: true,
    importedPipelineRuntimeFillSummary: {
        attached: false,
        rowCount: 8,
    },
}), {
    metaChips: [
        "savedPayload",
        "PDF",
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "Market Brief",
        "reportPrint",
        "Model Ad Delivery",
        "Preview Fill",
        "8 rows",
    ],
    hideLabel: "Hide export request",
    downloadLabel: "Download export request",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    content: "{\"pipeline\":true}",
});

assert.deepEqual(buildImportedPipelineExportJobPanelState({
    importedPipelineExportJobSummary: {
        jobId: "job-pipeline",
        status: "succeeded",
        artifactId: "artifact-1",
        canRefresh: false,
        hasArtifact: true,
        hasFailure: false,
        error: "",
    },
    importedPipelineExportRequestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    importedPipelineRuntimeFillSummary: {
        attached: false,
        rowCount: 8,
    },
    importedPipelineSummary: {
        title: "Capacity Trend Q3",
    },
}), {
    tone: "info",
    label: "Imported export",
    title: "Capacity Trend Q3",
    error: "",
    metaChips: [
        "job-pipeline",
        "succeeded",
        "artifact-1",
        "Market Brief",
        "template mismatch",
        "Preview Fill",
        "8 rows",
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    refreshLabel: "Refresh status",
    refreshDisabled: true,
    downloadLabel: "Download artifact",
    downloadDisabled: false,
});

assert.deepEqual(buildImportedPipelineExportFailureNotice({
    importedPipelineExportJob: {
        hasFailure: true,
        jobId: "job-pipeline-fail",
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
    importedPipelineExportRequestSummary: {
        templateLabel: "Market Brief",
        templateConflictLabel: "template mismatch",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    importedPipelineRuntimeFillSummary: {
        attached: false,
        rowCount: 8,
    },
}), {
    title: "Imported export failed",
    description: "Unsupported chart primitive in current renderer.",
    metaChips: ["Market Brief", "template mismatch", "Preview Fill", "8 rows"],
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

const conflictingImportedSavedViewExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: {
        title: "Capacity Q3 Saved View",
        from: "savedView",
        format: "PDF",
        artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
        documentVersion: 8,
        hasReportPrint: true,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
});
assert.equal(conflictingImportedSavedViewExportRequestPanelState.metaChips.includes("saved-view_capacity_q3"), false);
assert.equal(conflictingImportedSavedViewExportRequestPanelState.metaChips.includes("reportBuilder.savedView://saved_view_capacity_q3"), true);
assert.equal(conflictingImportedSavedViewExportRequestPanelState.metaChips.includes("Market Brief"), true);
assert.equal(conflictingImportedSavedViewExportRequestPanelState.metaChips.includes("template mismatch"), true);
assert.equal(conflictingImportedSavedViewExportRequestPanelState.templateConflict, true);

const conflictingImportedPublishedSnapshotExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: {
        title: "Capacity Q3 Published Snapshot",
        from: "publishedSnapshot",
        format: "PDF",
        artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
        documentVersion: 9,
        hasReportPrint: true,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Imported artifact template Market Brief does not match the embedded report document template Capacity Inventory Brief.",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
});
assert.equal(conflictingImportedPublishedSnapshotExportRequestPanelState.metaChips.includes("reportBuilder.publishedSnapshot://published_snapshot_capacity_q3"), true);
assert.equal(conflictingImportedPublishedSnapshotExportRequestPanelState.metaChips.includes("Market Brief"), true);
assert.equal(conflictingImportedPublishedSnapshotExportRequestPanelState.metaChips.includes("template mismatch"), true);
assert.equal(conflictingImportedPublishedSnapshotExportRequestPanelState.templateConflict, true);

assert.deepEqual(buildImportedStandaloneExportRequestInspectorState({
    importedStandaloneExportRequestSummary: {
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        hasReportPrint: true,
        reopenSourceResolutionTitle: "Resolved Reopen Sources",
        reopenSourceResolutionText: "Resolved reopen against the base report file.",
        reopenSourceResolutionChips: ["Base report file capacity_trend_q3_base • capacityTrendQ3"],
        reopenSourceResolutionSources: [
            {
                id: "baseReport",
                label: "Base report file",
                value: "capacity_trend_q3_base • capacityTrendQ3",
                source: {
                    kind: "reportBuilder.savedReportPayload",
                    sourceArtifactId: "capacity_trend_q3_base",
                    reportId: "capacityTrendQ3",
                },
            },
        ],
        templateId: "market_brief",
        templateLabel: "Market Brief",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: ["Model Ad Delivery"],
    },
    importedStandaloneExportRequestOpen: false,
}), {
    expandedMetaChips: [
        "savedPayload",
        "PDF",
        "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
        "Market Brief",
        "template mismatch",
        "ReportPrint",
        "Base report file capacity_trend_q3_base • capacityTrendQ3",
        "Model Ad Delivery",
    ],
    reopenSourceResolutionTitle: "Resolved Reopen Sources",
    reopenSourceResolutionText: "Resolved reopen against the base report file.",
    reopenSourceResolutionChips: ["Base report file capacity_trend_q3_base • capacityTrendQ3"],
    reopenSourceResolutionSources: [
        {
            id: "baseReport",
            label: "Base report file",
            value: "capacity_trend_q3_base • capacityTrendQ3",
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_trend_q3_base",
                reportId: "capacityTrendQ3",
            },
        },
    ],
    templateId: "market_brief",
    templateLabel: "Market Brief",
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: ["Model Ad Delivery"],
    inspectLabel: "Inspect export",
    downloadLabel: "Download export request",
});

assert.deepEqual(buildImportedStandaloneExportRequestInspectorState({
    importedStandaloneExportRequestSummary: {
        from: "savedPayload",
        format: "PDF",
        artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3",
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
                description: "Approved reporting window for imported export review.",
            },
        ],
    },
    importedStandaloneExportRequestOpen: false,
}), {
    expandedMetaChips: ["savedPayload", "PDF", "reportBuilder.savedReportPayload://rbreport_capacity_trend_q3", "ReportPrint", "Model Ad Delivery", "Entity Line Delivery"],
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
            description: "Approved reporting window for imported export review.",
        },
    ],
    inspectLabel: "Inspect export",
    downloadLabel: "Download export request",
});

const importedAudienceExportRequestSummary = buildReportBuilderExportRequestSummary(
    audienceArtifactFixture.reportExportRequest,
);
const importedAudienceExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: importedAudienceExportRequestSummary,
});
assert.equal(importedAudienceExportRequestPanelState.summaryValue, "Capacity Audience Segment Index Q3");
assert.equal(importedAudienceExportRequestPanelState.description, "Source: savedPayload • Format: CSV");
assert.equal(
    importedAudienceExportRequestPanelState.metaChips.includes("reportBuilder.savedReportPayload://rbreport_capacity_audience_segment_index_q3"),
    true,
);
assert.equal(importedAudienceExportRequestPanelState.metaChips.includes("v13"), true);
assert.equal(importedAudienceExportRequestPanelState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudienceExportRequestPanelState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(importedAudienceExportRequestPanelState.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    importedAudienceExportRequestPanelState.semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    importedAudienceExportRequestPanelState.semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const importedAudienceExportRequestInspectorState = buildImportedStandaloneExportRequestInspectorState({
    importedStandaloneExportRequestSummary: buildReportBuilderExportRequestInspectorState(
        audienceArtifactFixture.reportExportRequest,
    ),
    importedStandaloneExportRequestOpen: false,
});
assert.equal(
    importedAudienceExportRequestInspectorState.expandedMetaChips.includes("savedPayload"),
    true,
);
assert.equal(
    importedAudienceExportRequestInspectorState.expandedMetaChips.includes("CSV"),
    true,
);
assert.equal(
    importedAudienceExportRequestInspectorState.expandedMetaChips.includes("Measures Audience Index"),
    true,
);
assert.equal(
    importedAudienceExportRequestInspectorState.scopeSummaryText,
    "Date Range • Channels • Audience Segment",
);

const importedAudiencePDFExportRequestSummary = buildReportBuilderExportRequestSummary(
    audienceArtifactFixture.pdfReportExportRequest,
);
const importedAudiencePDFExportRequestPanelState = buildImportedStandaloneExportRequestPanelState({
    importedStandaloneExportRequestSummary: importedAudiencePDFExportRequestSummary,
});
assert.equal(importedAudiencePDFExportRequestPanelState.summaryValue, "Capacity Audience Segment Index Q3");
assert.equal(importedAudiencePDFExportRequestPanelState.description, "Source: savedPayload • Format: PDF");
assert.equal(importedAudiencePDFExportRequestPanelState.expandedMetaChips.includes("ReportPrint"), true);
assert.equal(importedAudiencePDFExportRequestPanelState.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(importedAudiencePDFExportRequestPanelState.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(importedAudiencePDFExportRequestPanelState.scopeSummaryText, "Date Range • Channels • Audience Segment");

const importedAudiencePDFExportRequestInspectorState = buildImportedStandaloneExportRequestInspectorState({
    importedStandaloneExportRequestSummary: buildReportBuilderExportRequestInspectorState(
        audienceArtifactFixture.pdfReportExportRequest,
    ),
    importedStandaloneExportRequestOpen: false,
});
assert.equal(
    importedAudiencePDFExportRequestInspectorState.expandedMetaChips.includes("PDF"),
    true,
);
assert.equal(
    importedAudiencePDFExportRequestInspectorState.expandedMetaChips.includes("ReportPrint"),
    true,
);
assert.equal(
    importedAudiencePDFExportRequestInspectorState.expandedMetaChips.includes("Measures Audience Index"),
    true,
);

assert.equal(buildImportedPipelinePreviewPanelState({}), null);
assert.equal(buildImportedLocalReopenablePanelState({}), null);
assert.equal(buildImportedLocalSavedRecordPanelState({}), null);
assert.equal(buildImportedStandaloneReportFillPanelState({}), null);
assert.equal(buildImportedStandaloneReportFillInspectorState({}), null);
assert.equal(buildImportedStandaloneReportPrintPanelState({}), null);
assert.equal(buildImportedStandaloneReportPrintInspectorState({}), null);
assert.equal(buildImportedStandaloneExportRequestPanelState({}), null);
assert.equal(buildImportedStandaloneExportRequestInspectorState({}), null);

console.log("reportBuilderImportedArtifactViewState ✓ derives imported artifact panel copy and action state");
