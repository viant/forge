import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildImportedLocalGetReportDocumentResponseIdentity,
    buildImportedLocalSavedReportRecordIdentity,
    normalizeReportBuilderImportedArtifactState,
    normalizeReportBuilderImportedLocalGetResponses,
    normalizeImportedLocalSavedReportRecords,
    resolveReportBuilderImportedArtifactImportPreservation,
    resolveImportedLocalSavedRecordRemovalEffect,
    resolveImportedLocalSavedRecordActivationResponse,
    resolveReportBuilderImportedLocalGetResponseForSavedRecord,
    resolveReportBuilderImportedLocalSavedRecordForGetResponse,
    resolveReportBuilderImportedLocalGetResponseByIdentity,
    resolveReportBuilderImportedLocalGetResponsesAfterImport,
    resolveReportBuilderImportedLocalGetResponsesAfterRemoval,
    resolveReportBuilderImportedLocalSavedReportRecordByIdentity,
    resolveReportBuilderImportedLocalSavedReportRecordsAfterImport,
    resolveReportBuilderImportedLocalSavedReportRecordsAfterRemoval,
    resolveReportBuilderImportedArtifactStateAfterImport,
} from "./reportBuilderImportedArtifactState.js";
import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const importedDetailTargetSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
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
        staticFilters: {
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

const currentState = {
    importedStandaloneReportFill: {
        kind: "reportFill",
        specVersion: 1,
        specHash: "fnv1a:fill0001",
        datasets: [{ id: "primary", rows: [{ channelV2: "Display" }] }],
    },
    importedStandaloneReportFillOpen: true,
    importedPipelineCompanionFillAttached: true,
    importedStandaloneReportPrint: {
        kind: "reportPrint",
        title: "Old Print",
    },
    importedStandaloneReportPrintOpen: true,
    importedStandaloneExportRequest: {
        kind: "reportExportRequest",
        source: {
            from: "draft",
        },
    },
    importedPipelinePreview: {
        kind: "reportSpec",
        title: "Current Spec",
        payload: {
            kind: "reportSpec",
            version: 1,
        },
    },
    importedPipelineInspectorSection: "reportFill",
    localSavedReportPayloadPresent: true,
    localSavedReportRecordPresent: true,
    localGetReportDocumentResponsePresent: true,
};

assert.deepEqual(normalizeReportBuilderImportedArtifactState(currentState), currentState);

assert.deepEqual(normalizeReportBuilderImportedLocalGetResponses([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Duplicate Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
]), [
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
]);

const normalizedAudienceGetResponses = normalizeReportBuilderImportedLocalGetResponses([
    audienceArtifactFixture.legacyGetReportDocumentResponse,
]);
assert.equal(normalizedAudienceGetResponses.length, 1);
assert.equal(
    normalizedAudienceGetResponses[0].document.semanticSummary.selectedMeasures[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    normalizedAudienceGetResponses[0].document.semanticSummary.selectedParameters[1].definitionRef,
    "harmonizer://feature/user.segment",
);
assert.equal(
    normalizedAudienceGetResponses[0].document.scope.params[2].id,
    "audienceSegmentFilter",
);
assert.equal(
    normalizedAudienceGetResponses[0].document.binding.modelRef,
    "model://example/performance/delivery@v1",
);
assert.equal(
    normalizedAudienceGetResponses[0].document.binding.entity,
    "line_delivery",
);

const normalizedEmbeddedBindingResponses = normalizeReportBuilderImportedLocalGetResponses([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "embeddedBindingTrendQ3" },
        document: {
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
        },
    },
]);
assert.equal(normalizedEmbeddedBindingResponses.length, 1);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.binding.modelRef,
    "model://example/performance/delivery@v1",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.binding.entity,
    "line_delivery",
);
assert.deepEqual(
    normalizedEmbeddedBindingResponses[0].document.binding.selectedDimensions,
    ["event_date", "channel"],
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.semanticSummary.modelRef,
    "model://example/performance/delivery@v1",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.semanticSummary.selectedDimensions[1].label,
    "Channel",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.semanticSummary.selectedMeasures[0].label,
    "Available Impressions",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.scope.dataSourceRef,
    "demoReportSource",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].document.scope.params[0].label,
    "Reporting Window",
);
assert.deepEqual(
    normalizedEmbeddedBindingResponses[0].document.scope.params[0].value,
    {
        start: "2026-05-01",
        end: "2026-05-04",
    },
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].reportSpec.kind,
    "reportSpec",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].reportSpec.binding.modelRef,
    "model://example/performance/delivery@v1",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].reportSpec.scope.dataSourceRef,
    "demoReportSource",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].compileState.status,
    "clean",
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].compileState.reportSpecVersion,
    1,
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].compileState.blockCount,
    1,
);
assert.equal(
    normalizedEmbeddedBindingResponses[0].compileState.datasetCount,
    1,
);

const normalizedEmbeddedBindingResponsesWithEmptySpec = normalizeReportBuilderImportedLocalGetResponses([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "embeddedBindingTrendQ3" },
        reportSpec: {},
        document: {
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
        },
    },
]);
assert.equal(normalizedEmbeddedBindingResponsesWithEmptySpec.length, 1);
assert.equal(
    normalizedEmbeddedBindingResponsesWithEmptySpec[0].document.binding.modelRef,
    "model://example/performance/delivery@v1",
);
assert.equal(
    normalizedEmbeddedBindingResponsesWithEmptySpec[0].document.semanticSummary.selectedDimensions[1].label,
    "Channel",
);
assert.equal(
    normalizedEmbeddedBindingResponsesWithEmptySpec[0].document.scope.params[0].label,
    "Reporting Window",
);
assert.equal(
    normalizedEmbeddedBindingResponsesWithEmptySpec[0].reportSpec.kind,
    "reportSpec",
);

assert.deepEqual(resolveReportBuilderImportedLocalGetResponsesAfterImport([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
], {
    kind: "createReportDocumentPayload",
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
}), [
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
]);

assert.equal(buildImportedLocalGetReportDocumentResponseIdentity({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityTrendImported" },
    document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}), "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported");

assert.deepEqual(resolveReportBuilderImportedLocalGetResponsesAfterRemoval([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
], "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported"), [
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
]);

assert.deepEqual(resolveReportBuilderImportedLocalGetResponseByIdentity([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendQ3" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendQ3", title: "Capacity Trend Q3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_trend",
            sourceArtifactId: "capacity_trend",
        },
    },
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityTrendImported" },
        document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
], "reportBuilder.savedReportPayload::rbreport_imported_capacity_trend::imported_capacity_trend::capacityTrendImported"), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityTrendImported" },
    document: { version: 1, kind: "reportDocument", id: "capacityTrendImported", title: "Capacity Trend Imported" },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
});
assert.equal(resolveReportBuilderImportedLocalGetResponseByIdentity([], "missing"), null);

assert.deepEqual(normalizeImportedLocalSavedReportRecords([
    {
        documentVersion: 9,
        savedAt: 9600,
        importedArtifactKind: "reportBuilder.savedReportRecord",
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedPayload",
            },
            reportSpec: { version: 1, kind: "reportSpec" },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity KPI Blend Q3" },
        },
    },
    {
        documentVersion: 9,
        savedAt: 9600,
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Duplicate Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
    },
]), [
    {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        compileState: {
            status: "clean",
            reportSpecVersion: 1,
            blockCount: 1,
            datasetCount: 1,
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        sourceIdentity: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportId: "capacityKpiBlendByDateQ3",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedPayload",
            },
            reportSpec: { version: 1, kind: "reportSpec" },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity KPI Blend Q3" },
        },
        exportable: true,
        importedArtifactKind: "reportBuilder.savedReportRecord",
    },
]);

assert.deepEqual(resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.savedReportRecord",
    savedRecord: {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        sourceIdentity: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportId: "",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedPayload",
            },
            reportSpec: { version: 1, kind: "reportSpec" },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity KPI Blend Q3" },
        },
    },
}), [
    {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        sourceIdentity: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportId: "",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedPayload",
            },
            reportSpec: { version: 1, kind: "reportSpec" },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity KPI Blend Q3" },
        },
        exportable: true,
        importedArtifactKind: "reportBuilder.savedReportRecord",
    },
]);

assert.deepEqual(resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.explorationArtifact",
    savedReportPayload: {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_exploration_capacity_q3",
        sourceArtifactId: "imported_exploration_capacity_q3",
        savedAt: 9800,
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "capacityExplorationQ3",
            title: "Capacity Exploration Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    },
}), [
    {
        reportId: "capacityExplorationQ3",
        title: "Capacity Exploration Q3",
        documentVersion: 0,
        savedAt: 9800,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityExplorationQ3",
            title: "Capacity Exploration Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        compileState: {
            status: "clean",
            reportSpecVersion: 1,
            blockCount: 1,
            datasetCount: 1,
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_exploration_capacity_q3",
            sourceArtifactId: "imported_exploration_capacity_q3",
        },
        sourceIdentity: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_exploration_capacity_q3",
            sourceArtifactId: "imported_exploration_capacity_q3",
            reportId: "capacityExplorationQ3",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_exploration_capacity_q3",
            sourceArtifactId: "imported_exploration_capacity_q3",
            savedAt: 9800,
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityExplorationQ3",
                title: "Capacity Exploration Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
        exportable: false,
        importedArtifactKind: "reportBuilder.explorationArtifact",
    },
]);

const importedSavedViewRecords = resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.savedView",
    savedRecord: {
        reportId: "capacityQ3",
        title: "Capacity Q3 Saved View",
        documentVersion: 8,
        savedAt: 9100,
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
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityQ3",
            sourceArtifactId: "saved_view_capacity_q3",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedView",
                artifactKind: "reportBuilder.savedView",
                artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
                sourceArtifactId: "saved_view_capacity_q3",
                reportId: "capacityQ3",
                documentVersion: 8,
                title: "Capacity Q3 Saved View",
            },
            reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
            reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3 Saved View" },
        },
    },
});
assert.equal(importedSavedViewRecords.length, 1);
assert.equal(importedSavedViewRecords[0].source?.kind, "reportBuilder.savedView");
assert.equal(importedSavedViewRecords[0].exportRequest?.source?.from, "savedView");
assert.equal(importedSavedViewRecords[0].exportable, true);
assert.equal(importedSavedViewRecords[0].importedArtifactKind, "reportBuilder.savedView");

const importedThinSavedViewRecords = resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.savedView",
    savedRecord: {
        reportId: "capacityQ3",
        title: "Capacity Q3 Saved View Overlay",
        documentVersion: 10,
        savedAt: 9150,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
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
});
assert.equal(importedThinSavedViewRecords.length, 1);
assert.equal(importedThinSavedViewRecords[0].source?.kind, "reportBuilder.savedView");
assert.equal(importedThinSavedViewRecords[0].exportable, false);
assert.equal(importedThinSavedViewRecords[0].exportRequest, undefined);
assert.equal(importedThinSavedViewRecords[0].importedArtifactKind, "reportBuilder.savedView");
assert.equal(importedThinSavedViewRecords[0].savedViewOverlay?.overlay?.presentation?.viewMode, "table");

const importedPublishedSnapshotRecords = resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.publishedSnapshot",
    savedRecord: {
        reportId: "capacityQ3",
        title: "Capacity Q3 Published Snapshot",
        documentVersion: 9,
        savedAt: 9200,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityQ3",
            sourceArtifactId: "published_snapshot_capacity_q3",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "publishedSnapshot",
                artifactKind: "reportBuilder.publishedSnapshot",
                artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
                sourceArtifactId: "published_snapshot_capacity_q3",
                reportId: "capacityQ3",
                documentVersion: 9,
                title: "Capacity Q3 Published Snapshot",
            },
            reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
            reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3 Published Snapshot" },
        },
    },
});
assert.equal(importedPublishedSnapshotRecords.length, 1);
assert.equal(importedPublishedSnapshotRecords[0].source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedPublishedSnapshotRecords[0].exportRequest?.source?.from, "publishedSnapshot");
assert.equal(importedPublishedSnapshotRecords[0].exportable, true);
assert.equal(importedPublishedSnapshotRecords[0].importedArtifactKind, "reportBuilder.publishedSnapshot");

const importedThinPublishedSnapshotRecords = resolveReportBuilderImportedLocalSavedReportRecordsAfterImport([], {
    kind: "reportBuilder.publishedSnapshot",
    savedRecord: {
        reportId: "capacityQ3",
        title: "Capacity Q3 Published Snapshot Overlay",
        documentVersion: 11,
        savedAt: 9250,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityQ3",
            title: "Capacity Q3 Published Snapshot Overlay",
        },
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityQ3",
            sourceArtifactId: "published_snapshot_capacity_q3_overlay",
        },
    },
});
assert.equal(importedThinPublishedSnapshotRecords.length, 1);
assert.equal(importedThinPublishedSnapshotRecords[0].source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(importedThinPublishedSnapshotRecords[0].exportable, false);
assert.equal(importedThinPublishedSnapshotRecords[0].exportRequest, undefined);
assert.equal(importedThinPublishedSnapshotRecords[0].importedArtifactKind, "reportBuilder.publishedSnapshot");

assert.equal(buildImportedLocalSavedReportRecordIdentity({
    reportId: "capacityKpiBlendByDateQ3",
    title: "Capacity KPI Blend Q3",
    documentVersion: 9,
    savedAt: 9600,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
    savedReportPayload: {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    },
}), "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3");
assert.deepEqual(resolveReportBuilderImportedLocalSavedReportRecordByIdentity([
    {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
    },
], "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3"), {
    reportId: "capacityKpiBlendByDateQ3",
    title: "Capacity KPI Blend Q3",
    documentVersion: 9,
    savedAt: 9600,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
    sourceIdentity: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        reportId: "",
    },
    savedReportPayload: {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    },
    exportable: false,
});
assert.deepEqual(resolveReportBuilderImportedLocalSavedReportRecordsAfterRemoval([
    {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
    },
    {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        documentVersion: 6,
        savedAt: 8990,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendQ3",
            title: "Capacity Trend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_trend",
            sourceArtifactId: "capacity_q3_trend",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_trend",
            sourceArtifactId: "capacity_q3_trend",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendQ3",
                title: "Capacity Trend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
    },
], "reportBuilder.savedReportPayload::rbreport_capacity_q3_kpi_blend_by_date::capacity_q3_kpi_blend_by_date::capacityKpiBlendByDateQ3"), [
    {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        documentVersion: 6,
        savedAt: 8990,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendQ3",
            title: "Capacity Trend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_trend",
            sourceArtifactId: "capacity_q3_trend",
        },
        sourceIdentity: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_trend",
            sourceArtifactId: "capacity_q3_trend",
            reportId: "",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_trend",
            sourceArtifactId: "capacity_q3_trend",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendQ3",
                title: "Capacity Trend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
        exportable: false,
    },
]);
assert.deepEqual(resolveReportBuilderImportedLocalGetResponseForSavedRecord([
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityKpiBlendByDateQ3" },
        documentVersion: 9,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
], {
    reportId: "capacityKpiBlendByDateQ3",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityKpiBlendByDateQ3" },
    documentVersion: 9,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
});
assert.equal(resolveReportBuilderImportedLocalGetResponseForSavedRecord([], {
    reportId: "missing",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing",
        sourceArtifactId: "missing",
    },
}), null);
assert.deepEqual(resolveReportBuilderImportedLocalSavedRecordForGetResponse([
    {
        reportId: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
        documentVersion: 9,
        savedAt: 9600,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
        },
    },
], {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityKpiBlendByDateQ3" },
    documentVersion: 9,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
}), {
    reportId: "capacityKpiBlendByDateQ3",
    title: "Capacity KPI Blend Q3",
    documentVersion: 9,
    savedAt: 9600,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
    sourceIdentity: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        reportId: "",
    },
    savedReportPayload: {
        version: 1,
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        reportDocument: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    },
    exportable: false,
});
assert.equal(resolveReportBuilderImportedLocalSavedRecordForGetResponse([], {
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing",
        sourceArtifactId: "missing",
    },
}), null);
assert.deepEqual(resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: { reportId: "capacityKpiBlendByDateQ3" },
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
                sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            },
        },
    ],
    savedRecord: {
        reportId: "capacityKpiBlendByDateQ3",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityKpiBlendByDateQ3" },
    documentVersion: 9,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
});
assert.deepEqual(resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses: [],
    savedRecord: {
        documentVersion: 9,
        savedAt: 9600,
        savedReportPayload: {
            version: 1,
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            reportDocument: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 1,
                datasetCount: 1,
            },
        },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "capacityKpiBlendByDateQ3" },
    documentVersion: 9,
    savedAt: 9600,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityKpiBlendByDateQ3",
        title: "Capacity KPI Blend Q3",
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
        sourceArtifactId: "capacity_q3_kpi_blend_by_date",
    },
});
assert.equal(resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses: [],
    savedRecord: {
        reportId: "missing",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "missing",
            sourceArtifactId: "missing",
        },
    },
}), null);

const importedAudienceActivationResponse = resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses: [],
    savedRecord: audienceArtifactFixture.savedReportRecord,
});
assert.equal(importedAudienceActivationResponse?.kind, "getReportDocumentResponse");
assert.deepEqual(
    importedAudienceActivationResponse?.reportSpec?.semanticSummary?.selectedMeasures?.find((field) => field?.id === "audience_index"),
    {
        id: "audience_index",
        rawId: "audienceIndex",
        label: "Audience Index",
        format: "number",
        category: "Audience",
        definitionRef: "harmonizer://feature/user.segment.index",
        governance: {
            status: "approved",
            certification: "reviewed",
            classification: "harmonizer.audience",
        },
    },
);
assert.deepEqual(
    importedAudienceActivationResponse?.reportSpec?.semanticSummary?.selectedParameters?.find((field) => field?.id === "audience_segment"),
    {
        id: "audience_segment",
        rawId: "audienceSegmentFilter",
        label: "Audience Segment",
        category: "Audience",
        definitionRef: "harmonizer://feature/user.segment",
        governance: {
            status: "approved",
            classification: "harmonizer.audience",
        },
    },
);
const importedDetailTargetActivationResponse = resolveImportedLocalSavedRecordActivationResponse({
    importedLocalGetReportDocumentResponses: [],
    savedRecord: {
        documentVersion: 21,
        savedAt: 10120,
        savedReportPayload: importedDetailTargetSavedPayload,
    },
});
assert.equal(importedDetailTargetActivationResponse?.kind, "getReportDocumentResponse");
assert.deepEqual(importedDetailTargetActivationResponse?.reportSpec?.drillMetadata, {
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
assert.deepEqual(resolveImportedLocalSavedRecordRemovalEffect({
    currentGetReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityKpiBlendByDateQ3" },
        documentVersion: 9,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
    importedLocalGetReportDocumentResponses: [],
    removedSavedRecord: {
        reportId: "capacityKpiBlendByDateQ3",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
}), {
    clearCurrentGetResponse: true,
});
assert.deepEqual(resolveImportedLocalSavedRecordRemovalEffect({
    currentGetReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: { reportId: "capacityKpiBlendByDateQ3" },
        documentVersion: 9,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityKpiBlendByDateQ3",
            title: "Capacity KPI Blend Q3",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
    importedLocalGetReportDocumentResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: { reportId: "capacityKpiBlendByDateQ3" },
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityKpiBlendByDateQ3",
                title: "Capacity KPI Blend Q3",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
                sourceArtifactId: "capacity_q3_kpi_blend_by_date",
            },
        },
    ],
    removedSavedRecord: {
        reportId: "capacityKpiBlendByDateQ3",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_kpi_blend_by_date",
            sourceArtifactId: "capacity_q3_kpi_blend_by_date",
        },
    },
}), {
    clearCurrentGetResponse: false,
});

assert.deepEqual(
    resolveReportBuilderImportedArtifactImportPreservation({
        kind: "reportFill",
        payload: { kind: "reportFill" },
    }, currentState),
    {
        preserveStandaloneReportFill: false,
        preservePipelinePreview: true,
        preserveSavedReportPayload: false,
        preserveSavedReportRecord: false,
        preserveGetReportDocumentResponse: false,
    },
);

assert.deepEqual(
    resolveReportBuilderImportedArtifactImportPreservation({
        kind: "reportSpec",
        payload: { kind: "reportSpec" },
    }, currentState),
    {
        preserveStandaloneReportFill: true,
        preservePipelinePreview: false,
        preserveSavedReportPayload: false,
        preserveSavedReportRecord: false,
        preserveGetReportDocumentResponse: false,
    },
);

assert.deepEqual(
    resolveReportBuilderImportedArtifactImportPreservation({
        kind: "reportPrint",
        payload: { kind: "reportPrint" },
    }, currentState),
    {
        preserveStandaloneReportFill: false,
        preservePipelinePreview: false,
        preserveSavedReportPayload: false,
        preserveSavedReportRecord: false,
        preserveGetReportDocumentResponse: false,
    },
);

assert.deepEqual(
    resolveReportBuilderImportedArtifactImportPreservation({
        kind: "listReportDocumentsResponse",
        payload: { kind: "listReportDocumentsResponse" },
    }, currentState),
    {
        preserveStandaloneReportFill: false,
        preservePipelinePreview: false,
        preserveSavedReportPayload: true,
        preserveSavedReportRecord: true,
        preserveGetReportDocumentResponse: true,
    },
);

const afterFillImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportFill",
    payload: {
        kind: "reportFill",
        specVersion: 2,
        specHash: "fnv1a:newfill",
        datasets: [{ id: "primary", rows: [{ channelV2: "CTV" }] }],
    },
});

assert.deepEqual(afterFillImport, {
    importedStandaloneReportFill: {
        kind: "reportFill",
        specVersion: 2,
        specHash: "fnv1a:newfill",
        datasets: [{ id: "primary", rows: [{ channelV2: "CTV" }] }],
    },
    importedStandaloneReportFillOpen: false,
    importedPipelineCompanionFillAttached: false,
    importedStandaloneReportPrint: null,
    importedStandaloneReportPrintOpen: false,
    importedStandaloneExportRequest: null,
    importedPipelinePreview: currentState.importedPipelinePreview,
    importedPipelineInspectorSection: "",
});

const afterSpecImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportSpec",
    title: "New Spec",
    payload: {
        kind: "reportSpec",
        version: 2,
    },
});

assert.deepEqual(afterSpecImport, {
    importedStandaloneReportFill: currentState.importedStandaloneReportFill,
    importedStandaloneReportFillOpen: false,
    importedPipelineCompanionFillAttached: false,
    importedStandaloneReportPrint: null,
    importedStandaloneReportPrintOpen: false,
    importedStandaloneExportRequest: null,
    importedPipelinePreview: {
        kind: "reportSpec",
        title: "New Spec",
        payload: {
            kind: "reportSpec",
            version: 2,
        },
    },
    importedPipelineInspectorSection: "",
});

const afterPrintImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportPrint",
    payload: {
        kind: "reportPrint",
        title: "Imported Print",
    },
});

assert.deepEqual(afterPrintImport, {
    importedStandaloneReportFill: null,
    importedStandaloneReportFillOpen: false,
    importedPipelineCompanionFillAttached: false,
    importedStandaloneReportPrint: {
        kind: "reportPrint",
        title: "Imported Print",
    },
    importedStandaloneReportPrintOpen: false,
    importedStandaloneExportRequest: null,
    importedPipelinePreview: null,
    importedPipelineInspectorSection: "",
});

const afterExportImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportExportRequest",
    payload: {
        kind: "reportExportRequest",
        source: {
            from: "savedPayload",
        },
    },
});

assert.deepEqual(afterExportImport, {
    importedStandaloneReportFill: null,
    importedStandaloneReportFillOpen: false,
    importedPipelineCompanionFillAttached: false,
    importedStandaloneReportPrint: null,
    importedStandaloneReportPrintOpen: false,
    importedStandaloneExportRequest: {
        kind: "reportExportRequest",
        source: {
            from: "savedPayload",
        },
    },
    importedPipelinePreview: null,
    importedPipelineInspectorSection: "",
});

const afterAudiencePrintImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportPrint",
    payload: audienceArtifactFixture.pdfReportPrint,
});

assert.equal(afterAudiencePrintImport.importedStandaloneReportPrint.kind, "reportPrint");
assert.equal(afterAudiencePrintImport.importedStandaloneReportPrint.title, "Capacity Audience Segment Index Q3");
assert.equal(afterAudiencePrintImport.importedStandaloneReportPrint.pageGeometry.width, 792);
assert.equal(afterAudiencePrintImport.importedStandaloneReportPrint.bookmarks.length, 4);
assert.equal(afterAudiencePrintImport.importedStandaloneReportPrintOpen, false);
assert.equal(afterAudiencePrintImport.importedStandaloneExportRequest, null);
assert.equal(afterAudiencePrintImport.importedPipelinePreview, null);

const afterAudiencePDFExportImport = resolveReportBuilderImportedArtifactStateAfterImport(currentState, {
    kind: "reportExportRequest",
    payload: audienceArtifactFixture.pdfReportExportRequest,
});

assert.equal(afterAudiencePDFExportImport.importedStandaloneExportRequest.kind, "reportExportRequest");
assert.equal(afterAudiencePDFExportImport.importedStandaloneExportRequest.target.format, "pdf");
assert.equal(afterAudiencePDFExportImport.importedStandaloneExportRequest.reportPrint.kind, "reportPrint");
assert.equal(
    afterAudiencePDFExportImport.importedStandaloneExportRequest.reportSpec.semanticSummary.selectedMeasures[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    afterAudiencePDFExportImport.importedStandaloneExportRequest.reportSpec.semanticSummary.selectedParameters[1].definitionRef,
    "harmonizer://feature/user.segment",
);
assert.equal(afterAudiencePDFExportImport.importedStandaloneReportPrint, null);
assert.equal(afterAudiencePDFExportImport.importedStandaloneReportPrintOpen, false);
assert.equal(afterAudiencePDFExportImport.importedPipelinePreview, null);

console.log("reportBuilderImportedArtifactState ✓ resolves imported artifact preserve/reset transitions");
