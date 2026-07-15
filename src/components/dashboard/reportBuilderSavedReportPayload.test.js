import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildReportBuilderGetReportDocumentResponse } from "./reportBuilderReportDocumentReadResponse.js";
import { buildHydratedReportBuilderDocument } from "./reportBuilderHydratedReportDocument.js";
import { instantiateReportBuilderDocumentTemplate } from "./reportBuilderDocumentTemplates.js";
import {
    buildReportBuilderRuntimePreview,
    buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";
import {
    buildReportBuilderSavedReportPayload,
    buildReportBuilderSavedReportPayloadRecord,
    buildReportBuilderSavedReportPayloadFromBuilderState,
    buildReportBuilderSavedReportExportRequestFromBuilderState,
    buildReportBuilderSavedReportPayloadDownload,
    buildReportBuilderSavedReportPayloadInspectorState,
    buildReportBuilderSavedReportPayloadSummary,
    serializeReportBuilderSavedReportPayload,
} from "./reportBuilderSavedReportPayload.js";
import {
    applyReportBuilderPersistedRuntimePreviewInteraction,
} from "./reportBuilderRuntimePreviewInteractionPersistence.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

function resolvePrimaryBuilderBlock(document = null) {
    return (Array.isArray(document?.blocks) ? document.blocks : [])
        .find((block) => String(block?.id || "").trim() === "primaryBuilder") || null;
}

function resolvePrimaryBuilderState(document = null) {
    return resolvePrimaryBuilderBlock(document)?.state || {};
}

const explorationArtifact = {
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_rbexplore_1000_5000",
    savedAt: 5000,
    title: "Exploration Demo",
    sourceSession: {
        sessionId: "rbexplore_1000",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        scope: {
            dataSourceRef: "demoReportSource",
            params: [
                {
                    id: "dateRange",
                    kind: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for semantic preview.",
                    required: true,
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
        diagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "The semantic provider returned 1 diagnostic for the current selection.",
            },
        ],
    },
};

const carriedSemanticBindingViewState = {
    title: "Semantic Binding",
    chips: [
        "Model Carried Delivery",
        "Measures Carried Spend",
    ],
    fieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "spend", label: "Carried Spend", format: "currency" },
            ],
        },
    ],
};

const payload = buildReportBuilderSavedReportPayload(explorationArtifact, { savedAt: 6000 });
assert.deepEqual(payload, {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    savedAt: 6000,
    title: "Exploration Demo",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceSession: {
        sessionId: "rbexplore_1000",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        scope: {
            dataSourceRef: "demoReportSource",
            params: [
                {
                    id: "dateRange",
                    kind: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for semantic preview.",
                    required: true,
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
        diagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "The semantic provider returned 1 diagnostic for the current selection.",
            },
        ],
    },
});

const carriedSemanticPayload = buildReportBuilderSavedReportPayload({
    ...explorationArtifact,
    artifactId: "semantic_binding_carried",
    title: "Carried Semantic Payload",
    semanticBindingViewState: carriedSemanticBindingViewState,
}, { savedAt: 6100 });
assert.deepEqual(carriedSemanticPayload.semanticBindingViewState, carriedSemanticBindingViewState);
const carriedSemanticPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    ...carriedSemanticPayload,
    reportDocument: {
        ...carriedSemanticPayload.reportDocument,
        semanticSummary: null,
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
});
assert.deepEqual(carriedSemanticPayloadSummary.semanticBindingChips, carriedSemanticBindingViewState.chips);
assert.deepEqual(carriedSemanticPayloadSummary.semanticBindingFieldGroups, carriedSemanticBindingViewState.fieldGroups);

const titleOnlyCarriedSemanticPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    ...carriedSemanticPayload,
    semanticBindingViewState: {
        title: "Semantic Binding",
    },
    reportDocument: {
        ...carriedSemanticPayload.reportDocument,
        semanticSummary: null,
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        binding: {
            mode: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            entity: "store_performance",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            modelLabel: "Revenue Operations",
            entity: "store_performance",
            entityLabel: "Store Performance",
            selectedMeasures: [
                { id: "net_revenue", rawId: "netRevenue", label: "Net Revenue" },
            ],
        },
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
});
assert.equal(titleOnlyCarriedSemanticPayloadSummary.semanticBindingChips.includes("Model Revenue Operations"), true);
assert.equal(titleOnlyCarriedSemanticPayloadSummary.semanticBindingChips.includes("Measures Net Revenue"), true);

const malformedFieldGroupCarriedSemanticPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    ...carriedSemanticPayload,
    semanticBindingViewState: {
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [{}],
            },
        ],
    },
    reportDocument: {
        ...carriedSemanticPayload.reportDocument,
        semanticSummary: null,
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        binding: {
            mode: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            entity: "store_performance",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/commerce/revenue@v1",
            modelLabel: "Revenue Operations",
            entity: "store_performance",
            entityLabel: "Store Performance",
            selectedMeasures: [
                { id: "net_revenue", rawId: "netRevenue", label: "Net Revenue" },
            ],
        },
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
});
assert.equal(malformedFieldGroupCarriedSemanticPayloadSummary.semanticBindingChips.includes("Model Revenue Operations"), true);
assert.equal(malformedFieldGroupCarriedSemanticPayloadSummary.semanticBindingChips.includes("Measures Net Revenue"), true);

const shareableSavedPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    ...carriedSemanticPayload,
    lifecycle: "published",
    ownerRef: "team://analytics",
    policyRef: "policy://reports/certified",
    badges: [
        { id: "certified", label: "Certified", tone: "success" },
    ],
    capabilities: {
        view: true,
        export: true,
    },
    grants: [
        { principalRef: "team://finance", role: "viewer" },
    ],
});
assert.deepEqual(shareableSavedPayloadSummary.shareableMetaChips, [
    "published",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Can View",
    "Can Export",
    "1 grant",
]);

const payloadRecord = buildReportBuilderSavedReportPayloadRecord(payload, {
    runtimeArtifact: {
        reportFill: {
            version: 1,
            kind: "reportFill",
        },
        reportPrint: {
            version: 1,
            kind: "reportPrint",
            title: "Exploration Demo",
        },
    },
});
assert.equal(payloadRecord, null);
assert.equal(buildReportBuilderSavedReportPayloadRecord(payload, { runtimeArtifact: null }), null);

assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceLabel: "2026-05-01 • Display",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
});

assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"kind": "reportBuilder\.savedReportPayload"/,
);
assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"reportDocument": \{/,
);
assert.match(
    serializeReportBuilderSavedReportPayload(payload),
    /"reportSpec": \{/,
);

assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    sourceLabel: "2026-05-01 • Display",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
    content: serializeReportBuilderSavedReportPayload(payload),
});

const savedViewBackedSavedPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedView",
    payloadId: "saved_view_capacity_q3_payload",
    sourceArtifactId: "saved_view_capacity_q3",
    title: "Capacity Q3 Saved View",
    reportDocument: {
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
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://capacityQ3",
            reportId: "capacityQ3",
            documentVersion: 9,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
            reportId: "capacityQ3",
            documentVersion: 10,
            sourceArtifactId: "published_snapshot_capacity_q3",
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
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Base",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_base",
                reportId: "capacityQ3",
            },
        },
        {
            reportId: "capacityQ3",
            documentVersion: 10,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacity_q3",
                reportId: "capacityQ3",
            },
        },
    ],
});
assert.deepEqual(savedViewBackedSavedPayloadSummary.savedViewOverlayChips, [
    "1 filter",
    "table view",
    "Base v9",
    "Snapshot v10",
]);
assert.deepEqual(savedViewBackedSavedPayloadSummary.reopenSourceResolutionChips, [
    "Published snapshot published_snapshot_capacity_q3 • capacityQ3",
    "Base report file capacity_q3_base • capacityQ3",
]);
assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState({
    version: 1,
    kind: "reportBuilder.savedView",
    payloadId: "saved_view_capacity_q3_payload",
    sourceArtifactId: "saved_view_capacity_q3",
    title: "Capacity Q3 Saved View",
    reportDocument: {
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
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://capacityQ3",
            reportId: "capacityQ3",
            documentVersion: 9,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
            reportId: "capacityQ3",
            documentVersion: 10,
            sourceArtifactId: "published_snapshot_capacity_q3",
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
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Base",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_q3_base",
                reportId: "capacityQ3",
            },
        },
        {
            reportId: "capacityQ3",
            documentVersion: 10,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacity_q3",
                reportId: "capacityQ3",
            },
        },
    ],
}).reopenSourceResolutionChips, [
    "Published snapshot published_snapshot_capacity_q3 • capacityQ3",
    "Base report file capacity_q3_base • capacityQ3",
]);

const audienceDocumentScopePayload = {
    ...audienceArtifactFixture.savedReportPayload,
    reportSpec: {
        ...audienceArtifactFixture.savedReportPayload.reportSpec,
    },
};
delete audienceDocumentScopePayload.reportSpec.scope;
const audienceSavedPayloadSummary = buildReportBuilderSavedReportPayloadSummary(audienceDocumentScopePayload);
assert.equal(audienceSavedPayloadSummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceSavedPayloadSummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceSavedPayloadSummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(audienceSavedPayloadSummary.authoredBlockCount, 4);
assert.equal(audienceSavedPayloadSummary.authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(audienceSavedPayloadSummary.drillHierarchyCount, 2);
assert.equal(audienceSavedPayloadSummary.detailTargetCount, 2);
assert.equal(audienceSavedPayloadSummary.drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");
assert.deepEqual(audienceSavedPayloadSummary.scopeSummaryItems, [
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
]);

const embeddedSavedPayloadSummary = buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_embedded_saved_payload",
    sourceArtifactId: "embedded_saved_payload",
    title: "Embedded Saved Payload",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedSavedPayload",
        title: "Embedded Saved Payload",
        subtitle: "Embedded metadata",
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
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", category: "Time" },
                        { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Reporting Window",
                            description: "Embedded saved payload scope.",
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
                    selectedDimensions: ["eventDate", "channelV2"],
                    selectedMeasures: ["avails"],
                    scopeParams: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
    compileState: {
        status: "clean",
        blockCount: 1,
        datasetCount: 1,
    },
});
assert.equal(embeddedSavedPayloadSummary.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedSavedPayloadSummary.scopeSummaryText, "Reporting Window");

const runtimeScopedSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_runtime_scoped_dataset",
    sourceArtifactId: "runtime_scoped_dataset",
    title: "Runtime Scoped Dataset",
    sourceSession: {
        sessionId: "rb_session_runtime_scoped",
    },
}, {
    container: {
        id: "publishedDatasetBuilder",
        stateKey: "publishedDatasetBuilder",
        title: "Published Dataset Builder",
        dataSourceRef: "demoReportSource",
    },
    config: {
        title: "Published Dataset Builder",
        measures: [
            { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
        ],
        dimensions: [
            { id: "channelId", key: "channelId", label: "Channel", default: true },
        ],
        result: {
            defaultMode: "table",
        },
        dataSources: [
            {
                id: "forecast_cube",
                dataSourceRef: "forecastCubeSource",
                label: "Forecast Cube",
                kindLabel: "published",
                source: {
                    kind: "mcp",
                    toolName: "demo:forecast_summary",
                },
                resultContract: {
                    shape: "rowSet",
                    rowPath: "payload.records",
                },
                capabilities: {
                    backendRefetch: true,
                },
                request: {
                    measures: { forecastRevenue: true },
                    dimensions: { region: true },
                    filters: {},
                    limit: 25,
                    offset: 0,
                },
                columnOptions: [
                    { key: "region", label: "Region", kind: "dimension" },
                    { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
                ],
                scopeParamOptions: [
                    {
                        value: "forecastRegion",
                        label: "Forecast Region",
                        kind: "multiSelect",
                        paramPath: "filters.region",
                    },
                ],
            },
        ],
    },
    state: {
        selectedMeasures: ["totalSpend"],
        primaryMeasure: "totalSpend",
        selectedDimensions: ["channelId"],
        viewMode: "table",
        reportDocumentBlocks: [
            {
                id: "forecastFilters",
                kind: "filterBarBlock",
                title: "Forecast Filters",
                datasetRef: "forecast_cube",
                paramIds: ["forecastRegion"],
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [{ blockId: "forecastFilters" }],
        },
        ...applyReportBuilderPersistedRuntimePreviewInteraction({}, {
            datasetScopeParams: {
                forecast_cube: {
                    forecastRegion: ["US/CA"],
                },
            },
        }),
    },
});
assert.deepEqual(runtimeScopedSavedPayload.sourceSession.runtimePreviewInteraction.datasetScopeParams, {
    forecast_cube: {
        forecastRegion: ["US/CA"],
    },
});
assert.deepEqual(runtimeScopedSavedPayload.reportSpec.datasets.find((dataset) => dataset.id === "forecast_cube")?.request.filters, {
    region: ["US/CA"],
});
const runtimeScopedSavedPreview = buildReportBuilderRuntimePreview({
    model: buildReportBuilderRuntimePreviewModel({
        container: {
            id: "publishedDatasetBuilder",
            stateKey: "publishedDatasetBuilder",
            title: "Published Dataset Builder",
            dataSourceRef: "demoReportSource",
        },
        config: {
            title: "Published Dataset Builder",
            measures: [
                { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
            ],
            dimensions: [
                { id: "channelId", key: "channelId", label: "Channel", default: true },
            ],
            result: {
                defaultMode: "table",
            },
            dataSources: [
                {
                    id: "forecast_cube",
                    dataSourceRef: "forecastCubeSource",
                    label: "Forecast Cube",
                    kindLabel: "published",
                    source: {
                        kind: "mcp",
                        toolName: "demo:forecast_summary",
                    },
                    resultContract: {
                        shape: "rowSet",
                        rowPath: "payload.records",
                    },
                    capabilities: {
                        backendRefetch: true,
                    },
                    request: {
                        measures: { forecastRevenue: true },
                        dimensions: { region: true },
                        filters: {},
                        limit: 25,
                        offset: 0,
                    },
                    columnOptions: [
                        { key: "region", label: "Region", kind: "dimension" },
                        { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
                    ],
                    scopeParamOptions: [
                        {
                            value: "forecastRegion",
                            label: "Forecast Region",
                            kind: "multiSelect",
                            paramPath: "filters.region",
                        },
                    ],
                },
            ],
        },
        state: {
            selectedMeasures: ["totalSpend"],
            primaryMeasure: "totalSpend",
            selectedDimensions: ["channelId"],
            viewMode: "table",
            reportDocumentBlocks: [
                {
                    id: "forecastFilters",
                    kind: "filterBarBlock",
                    title: "Forecast Filters",
                    datasetRef: "forecast_cube",
                    paramIds: ["forecastRegion"],
                },
            ],
            reportDocumentLayout: {
                type: "stack",
                items: [{ blockId: "forecastFilters" }],
            },
            ...applyReportBuilderPersistedRuntimePreviewInteraction({}, {
                datasetScopeParams: {
                    forecast_cube: {
                        forecastRegion: ["US/CA"],
                    },
                },
            }),
        },
        includePrimaryBlocks: false,
    }),
    rows: [],
    hasMore: false,
    datasetPayloads: {
        forecast_cube: {
            rows: [{ region: "US/CA", forecastRevenue: 1200 }],
            hasMore: false,
            diagnostics: [],
        },
    },
});
const runtimeScopedSavedExportRequest = buildReportBuilderSavedReportExportRequestFromBuilderState(runtimeScopedSavedPayload, {
    container: {
        id: "publishedDatasetBuilder",
        stateKey: "publishedDatasetBuilder",
        title: "Published Dataset Builder",
        dataSourceRef: "demoReportSource",
    },
    config: {
        title: "Published Dataset Builder",
        measures: [
            { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, format: "currency" },
        ],
        dimensions: [
            { id: "channelId", key: "channelId", label: "Channel", default: true },
        ],
        result: {
            defaultMode: "table",
        },
        dataSources: [
            {
                id: "forecast_cube",
                dataSourceRef: "forecastCubeSource",
                label: "Forecast Cube",
                kindLabel: "published",
                source: {
                    kind: "mcp",
                    toolName: "demo:forecast_summary",
                },
                resultContract: {
                    shape: "rowSet",
                    rowPath: "payload.records",
                },
                capabilities: {
                    backendRefetch: true,
                },
                request: {
                    measures: { forecastRevenue: true },
                    dimensions: { region: true },
                    filters: {},
                    limit: 25,
                    offset: 0,
                },
                columnOptions: [
                    { key: "region", label: "Region", kind: "dimension" },
                    { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure", format: "currency" },
                ],
                scopeParamOptions: [
                    {
                        value: "forecastRegion",
                        label: "Forecast Region",
                        kind: "multiSelect",
                        paramPath: "filters.region",
                    },
                ],
            },
        ],
    },
    state: {
        selectedMeasures: ["totalSpend"],
        primaryMeasure: "totalSpend",
        selectedDimensions: ["channelId"],
        viewMode: "table",
        reportDocumentBlocks: [
            {
                id: "forecastFilters",
                kind: "filterBarBlock",
                title: "Forecast Filters",
                datasetRef: "forecast_cube",
                paramIds: ["forecastRegion"],
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [{ blockId: "forecastFilters" }],
        },
        ...applyReportBuilderPersistedRuntimePreviewInteraction({}, {
            datasetScopeParams: {
                forecast_cube: {
                    forecastRegion: ["US/CA"],
                },
            },
        }),
    },
    runtimeArtifact: runtimeScopedSavedPreview,
    documentVersion: 1,
});
assert.deepEqual(runtimeScopedSavedExportRequest.reportFill.datasets.find((dataset) => dataset.id === "forecast_cube")?.source, {
    kind: "mcp",
    toolName: "demo:forecast_summary",
});
assert.deepEqual(runtimeScopedSavedExportRequest.reportFill.datasets.find((dataset) => dataset.id === "forecast_cube")?.resultContract, {
    shape: "rowSet",
    rowPath: "payload.records",
});
assert.deepEqual(runtimeScopedSavedExportRequest.reportFill.datasets.find((dataset) => dataset.id === "forecast_cube")?.capabilities, {
    backendRefetch: true,
});
assert.deepEqual(runtimeScopedSavedPayload.reportDocument.scope.params.find((param) => param.id === "forecastRegion")?.value, ["US/CA"]);

const embeddedSavedPayloadSummaryWithEmptySpecScope = buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_embedded_saved_payload_empty_scope",
    sourceArtifactId: "embedded_saved_payload_empty_scope",
    title: "Embedded Saved Payload",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedSavedPayload",
        title: "Embedded Saved Payload",
        subtitle: "Embedded metadata",
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
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Delivery Date", category: "Time" },
                        { id: "channelV2", key: "channelV2", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Reporting Window",
                            description: "Embedded saved payload scope.",
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
                    selectedDimensions: ["eventDate", "channelV2"],
                    selectedMeasures: ["avails"],
                    scopeParams: {
                        dateRange: {
                            start: "2026-05-01",
                            end: "2026-05-04",
                        },
                    },
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
        scope: {
            params: [],
        },
    },
    compileState: {
        status: "clean",
        blockCount: 1,
        datasetCount: 1,
    },
});
assert.equal(embeddedSavedPayloadSummaryWithEmptySpecScope.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedSavedPayloadSummaryWithEmptySpecScope.scopeSummaryText, "Reporting Window");

assert.deepEqual(buildReportBuilderSavedReportPayloadDownload(payload), {
    filename: "Exploration Demo-saved-report-payload.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderSavedReportPayload(payload),
});

assert.equal(buildReportBuilderSavedReportPayload(null), null);
assert.equal(buildReportBuilderSavedReportPayloadSummary(null), null);
assert.equal(serializeReportBuilderSavedReportPayload(null), "");
assert.equal(buildReportBuilderSavedReportPayloadInspectorState(null), null);
assert.equal(buildReportBuilderSavedReportPayloadDownload(null), null);

assert.equal(buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_invalid",
    sourceArtifactId: "invalid_artifact",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "invalidReportBuilder",
        title: "Invalid Authored Blocks",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", key: "avails", label: "Available Impressions", default: true },
                    ],
                },
                state: {
                    selectedMeasures: [],
                    selectedDimensions: [],
                },
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Available Impressions",
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
})?.compileStatus, "clean");

assert.equal(buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_stored_compile_state",
    sourceArtifactId: "stored_compile_state",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "storedCompileState",
        title: "Stored Compile State",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", key: "avails", label: "Available Impressions", default: true },
                    ],
                },
                state: {
                    selectedMeasures: [],
                    selectedDimensions: [],
                },
            },
        ],
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
        diagnostics: [],
    },
})?.compileStatus, "clean");

assert.equal(buildReportBuilderSavedReportPayloadSummary({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_mixed_static_saved_payload",
    sourceArtifactId: "mixed_static_saved_payload",
    title: "Mixed Static Saved Payload",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "mixedStaticSavedPayload",
        title: "Mixed Static Saved Payload",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", key: "avails", label: "Available Impressions", default: true },
                    ],
                    dimensions: [
                        { id: "eventDate", key: "eventDate", label: "Event Date", default: true },
                    ],
                },
                state: {
                    selectedMeasures: ["avails"],
                    selectedDimensions: ["eventDate"],
                    reportStaticDatasets: [
                        {
                            id: "segment_status_csv",
                            label: "Segment Status",
                            sourceFormat: "csv",
                            columns: [
                                { key: "segment", label: "Segment", kind: "dimension" },
                                { key: "score", label: "Score", kind: "measure" },
                                { key: "status", label: "Status", kind: "dimension" },
                            ],
                            rows: [
                                { segment: "North", score: 10, status: "healthy" },
                                { segment: "South", score: 7, status: "watch" },
                            ],
                        },
                    ],
                },
            },
            {
                id: "segmentScoreKpi",
                kind: "kpiBlock",
                title: "Segment Score KPI",
                datasetRef: "segment_status_csv",
                valueField: "score",
                valueLabel: "Score",
                secondaryField: "segment",
                secondaryLabel: "Segment",
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "segmentScoreKpi" }],
        datasets: [
            { id: "primary" },
            { id: "segment_status_csv" },
        ],
    },
})?.compileStatus, "clean");

const templatedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_inventory_brief",
    savedAt: 9100,
    title: "Capacity Inventory Brief",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceSession: {
        sessionId: "rbexplore_capacity_inventory_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
            contextLabel: "Capacity Inventory Brief • Inventory Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityInventoryBrief",
        title: "Capacity Inventory Brief",
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
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(templatedPayload), {
    title: "Capacity Inventory Brief",
    payloadId: "rbreport_capacity_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceLabel: "Capacity Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});

assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(templatedPayload), {
    title: "Capacity Inventory Brief",
    payloadId: "rbreport_capacity_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceLabel: "Capacity Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    content: serializeReportBuilderSavedReportPayload(templatedPayload),
});

const explicitTemplatedPayload = {
    ...templatedPayload,
    reportDocument: {
        ...templatedPayload.reportDocument,
        templateId: "market_brief",
        templateLabel: "Market Brief",
        blocks: [],
    },
};

assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(explicitTemplatedPayload), {
    title: "Capacity Inventory Brief",
    payloadId: "rbreport_capacity_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceLabel: "Capacity Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    templateId: "market_brief",
    templateLabel: "Market Brief",
});
assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(explicitTemplatedPayload), {
    title: "Capacity Inventory Brief",
    payloadId: "rbreport_capacity_inventory_brief",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceLabel: "Capacity Inventory Brief • Inventory Ladder",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Saved report file template Market Brief does not match the source-session seed template Capacity Inventory Brief.",
    templateId: "market_brief",
    templateLabel: "Market Brief",
    content: serializeReportBuilderSavedReportPayload(explicitTemplatedPayload),
});

const reopenedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_trend",
    savedAt: 9300,
    title: "Capacity Trend Q3",
    sourceArtifactId: "capacity_q3_channel_trend",
    sourceSession: {
        sessionId: "rbexplore_capacityTrendQ3",
        sourceRef: {
            kind: "reportBuilder.chartResult",
            contextLabel: "Capacity Trend Q3 • Avails by Date and Channel",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
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
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        chartSpec: {
            title: "Avails by Date and Channel",
            type: "area",
            xField: "eventDate",
            yFields: ["avails"],
            seriesField: "channelV2",
        },
        scopeParams: {
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
        reportDocumentReopenSession: {
            reportId: "capacityTrendQ3",
        },
    },
    savedAt: 9400,
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Event Date" },
            { id: "channel", rawId: "channelV2", label: "Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
        ],
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
    ],
});
assert.equal(reopenedPayload.reportDocument.id, "capacityTrendQ3");
assert.equal(reopenedPayload.reportDocument.title, "Capacity Trend Q3");
assert.equal(reopenedPayload.reportSpec.title, "Capacity Trend Q3");
assert.equal(reopenedPayload.reportSpec.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(resolvePrimaryBuilderState(reopenedPayload.reportDocument).viewMode, "table");
assert.equal(reopenedPayload.compileState.diagnostics[0].code, "semanticGovernance");
assert.equal(reopenedPayload.compileState.status, "clean");
assert.equal(
    Object.prototype.hasOwnProperty.call(resolvePrimaryBuilderState(reopenedPayload.reportDocument), "reportDocumentReopenSession"),
    false,
);
assert.equal(reopenedPayload.savedAt, 9400);

const reopenedPayloadWithUpdatedTitle = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_trend",
    savedAt: 9300,
    title: "Capacity Trend Q3",
    sourceArtifactId: "capacity_q3_channel_trend",
    sourceSession: {
        sessionId: "rbexplore_capacityTrendQ3",
        sourceRef: {
            kind: "reportBuilder.chartResult",
            contextLabel: "Capacity Trend Q3 • Avails by Date and Channel",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
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
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        reportDocumentTitle: "Capacity Trend Q3 Live",
        chartSpec: {
            title: "Avails by Date and Channel",
            type: "area",
            xField: "eventDate",
            yFields: ["avails"],
            seriesField: "channelV2",
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
        reportDocumentReopenSession: {
            reportId: "capacityTrendQ3",
        },
    },
    savedAt: 9401,
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Event Date" },
            { id: "channel", rawId: "channelV2", label: "Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
        ],
    },
});

assert.equal(reopenedPayloadWithUpdatedTitle.reportDocument.title, "Capacity Trend Q3 Live");
assert.equal(reopenedPayloadWithUpdatedTitle.reportSpec.title, "Capacity Trend Q3 Live");
assert.equal(reopenedPayloadWithUpdatedTitle.title, "Capacity Trend Q3 Live");
assert.equal(buildReportBuilderSavedReportPayloadSummary(reopenedPayloadWithUpdatedTitle).title, "Capacity Trend Q3 Live");

const loadingFallbackPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_loading",
    savedAt: 9300,
    title: "Capacity Trend Q3",
    sourceArtifactId: "capacity_q3_loading",
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
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
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
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticModel: null,
    semanticModelProviderAvailable: true,
    semanticModelLoading: true,
    fallbackSemanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Fallback Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Fallback Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Fallback Event Date" },
            { id: "channel", rawId: "channelV2", label: "Fallback Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Fallback Available Impressions", format: "compactNumber" },
        ],
    },
    fallbackSemanticFingerprint: JSON.stringify({
        modelRef: "model://example/performance/delivery@v1",
        selection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["available_impressions"],
            parameters: {},
        },
    }),
});

assert.equal(loadingFallbackPayload.reportSpec.semanticSummary.modelLabel, "Fallback Ad Delivery");
assert.equal(loadingFallbackPayload.reportSpec.semanticSummary.entityLabel, "Fallback Line Delivery");
assert.equal(loadingFallbackPayload.reportSpec.semanticSummary.selectedDimensions[0].label, "Fallback Event Date");

const unavailableFallbackPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_unavailable",
    savedAt: 9300,
    title: "Capacity Trend Q3",
    sourceArtifactId: "capacity_q3_unavailable",
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
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
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
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticModel: null,
    semanticModelProviderAvailable: false,
    semanticModelLoading: false,
    fallbackSemanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Fallback Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Fallback Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Fallback Event Date" },
            { id: "channel", rawId: "channelV2", label: "Fallback Channel" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Fallback Available Impressions", format: "compactNumber" },
        ],
    },
    fallbackSemanticFingerprint: JSON.stringify({
        modelRef: "model://example/performance/delivery@v1",
        selection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["available_impressions"],
            parameters: {},
        },
    }),
});

assert.equal(unavailableFallbackPayload.reportSpec.semanticSummary.modelLabel || "", "");
assert.equal(unavailableFallbackPayload.reportSpec.semanticSummary.entityLabel || "", "");
assert.equal(unavailableFallbackPayload.reportSpec.semanticSummary.selectedDimensions[0].label, "Event Date");

const reopenedPayloadWithDuplicateSemanticDiagnostics = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_trend",
    savedAt: 9300,
    title: "Capacity Trend Q3",
    sourceArtifactId: "capacity_q3_channel_trend",
    sourceSession: {
        sessionId: "rbexplore_capacityTrendQ3",
        sourceRef: {
            kind: "reportBuilder.chartResult",
            contextLabel: "Capacity Trend Q3 • Avails by Date and Channel",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
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
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
        {
            code: "semanticGovernance",
            severity: "info",
            message: "Audience Age Group • Draft",
        },
    ],
});
assert.equal(reopenedPayloadWithDuplicateSemanticDiagnostics.compileState.diagnostics.length, 1);

const derivedSemanticPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_semantic_runtime",
    savedAt: 9300,
    title: "Semantic Runtime Demo",
    sourceArtifactId: "semantic_runtime_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "semanticRuntimeDemo",
        title: "Semantic Runtime Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
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
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    savedAt: 9410,
    semanticModel: {
        modelRef: "model://example/performance/delivery@v1",
        version: 1,
        label: "Ad Delivery",
        entities: [
            {
                id: "line_delivery",
                label: "Line Delivery",
                dimensions: [
                    { id: "event_date", label: "Delivery Date", category: "Time" },
                    { id: "channel", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
                ],
            },
        ],
    },
});

assert.equal(derivedSemanticPayload.reportDocument.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedSemanticPayload.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(derivedSemanticPayload.reportSpec.semanticSummary.selectedDimensions[1].definitionRef, "semantic://example/channel");
assert.equal(derivedSemanticPayload.reportSpec.semanticSummary.selectedMeasures[0].category, "Metrics");
assert.equal(derivedSemanticPayload.reportDocument.blocks[0].config.semanticModel.modelRef, "model://example/performance/delivery@v1");
assert.equal(derivedSemanticPayload.reportDocument.datasets[0].measures[0].label, "Available Impressions");
assert.equal(derivedSemanticPayload.reportDocument.datasets[0].dimensions[0].label, "Delivery Date");
assert.equal(derivedSemanticPayload.semanticBindingViewState.title, "Semantic Binding");
assert.equal(derivedSemanticPayload.semanticBindingViewState.chips.includes("Model Ad Delivery"), true);
assert.deepEqual(buildReportBuilderSavedReportPayloadSummary(derivedSemanticPayload), {
    title: "Semantic Runtime Demo",
    payloadId: "rbreport_semantic_runtime",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "semantic_runtime_demo",
    sourceLabel: "",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
        "Categories Time, Delivery +1",
        "Lineage semantic://example/channel",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", format: "date", category: "Time" },
                { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "dateRange",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "dateRange",
        },
    ],
});
assert.deepEqual(buildReportBuilderSavedReportPayloadInspectorState(derivedSemanticPayload), {
    title: "Semantic Runtime Demo",
    payloadId: "rbreport_semantic_runtime",
    kind: "reportBuilder.savedReportPayload",
    sourceArtifactId: "semantic_runtime_demo",
    sourceLabel: "",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
        "Categories Time, Delivery +1",
        "Lineage semantic://example/channel",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", format: "date", category: "Time" },
                { id: "channel", rawId: "channelV2", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", category: "Metrics", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "dateRange",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "dateRange",
        },
    ],
    content: serializeReportBuilderSavedReportPayload(derivedSemanticPayload),
});

const payloadWithAuthoredBlocks = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_authored_blocks",
    savedAt: 9300,
    title: "Authored Blocks Demo",
    sourceArtifactId: "authored_blocks_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "authoredBlocksDemo",
        title: "Authored Blocks Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
        ],
        result: {
            chartCreationMode: "explicit",
            defaultMode: "chart",
            pageSize: 50,
            orderFields: [
                { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            ],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        reportDocumentThemeAccent: "green",
        reportDocumentBadgePalette: "bold",
        reportDocumentBlocks: [
            {
                id: "overviewSection",
                kind: "sectionBlock",
                title: "Overview",
                navigationLabel: "Overview",
            },
            {
                id: "summaryPanel",
                kind: "compositeBlock",
                title: "Summary panel",
                description: "Groups the intro and process blocks.",
                childBlockIds: ["directIntro", "integrationFlow"],
            },
            {
                id: "launchCallout",
                kind: "calloutBlock",
                title: "Launch update",
                icon: "warning-sign",
                description: "Important rollout note.",
                tone: "warning",
                badges: ["Executive", "Launch Ready"],
                body: "Publisher activation is staged for Friday.",
            },
            {
                id: "sectionTabs",
                kind: "tabGroupBlock",
                title: "Forecast views",
                sectionIds: ["overviewSection"],
                defaultSectionId: "overviewSection",
            },
            {
                id: "directIntro",
                kind: "infoPanelBlock",
                title: "What is a Direct Integration Path?",
                body: "Authored explainer.",
            },
            {
                id: "narrativeIntro",
                kind: "markdownBlock",
                title: "Narrative",
                markdown: "## Narrative\nAuthored context.",
            },
            {
                id: "integrationFlow",
                kind: "stepperBlock",
                title: "Direct Integration Path",
                steps: [
                    { id: "step_1", title: "Bid directly", body: "Connect bidding directly to the publisher ad server." },
                ],
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Avails",
            },
            {
                id: "publisherPipeline",
                kind: "kanbanBlock",
                title: "Publisher Pipeline",
                columns: [
                    { id: "signed", title: "Signed", cards: [{ id: "tubi", title: "Tubi" }] },
                ],
            },
            {
                id: "integrationTimeline",
                kind: "timelineBlock",
                title: "Integration Timeline",
                events: [
                    { id: "event_1", date: "2026-07-15", title: "Roku signed" },
                ],
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "overviewSection" },
                { blockId: "summaryPanel" },
                { blockId: "launchCallout" },
                { blockId: "sectionTabs" },
                { blockId: "directIntro" },
                { blockId: "narrativeIntro" },
                { blockId: "integrationFlow" },
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi" },
                { blockId: "publisherPipeline" },
                { blockId: "integrationTimeline" },
            ],
        },
    },
    savedAt: 9500,
});
assert.deepEqual(payloadWithAuthoredBlocks.reportDocument.layout, {
    type: "stack",
    items: [
        { blockId: "overviewSection" },
        { blockId: "summaryPanel" },
        { blockId: "launchCallout" },
        { blockId: "sectionTabs" },
        { blockId: "directIntro" },
        { blockId: "narrativeIntro" },
        { blockId: "integrationFlow" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
        { blockId: "publisherPipeline" },
        { blockId: "integrationTimeline" },
    ],
});
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "overviewSection")?.kind, "sectionBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "summaryPanel")?.kind, "compositeBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "launchCallout")?.kind, "calloutBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "sectionTabs")?.kind, "tabGroupBlock");
assert.deepEqual(payloadWithAuthoredBlocks.reportDocument.theme, {
    accentTone: "green",
    badgePalette: "bold",
});
assert.deepEqual(payloadWithAuthoredBlocks.reportSpec.theme, {
    accentTone: "green",
    badgePalette: "bold",
});
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "directIntro")?.kind, "infoPanelBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "narrativeIntro")?.kind, "markdownBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "integrationFlow")?.kind, "stepperBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "headlineKpi")?.kind, "kpiBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "publisherPipeline")?.kind, "kanbanBlock");
assert.equal(payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "integrationTimeline")?.kind, "timelineBlock");
assert.equal(
    Object.prototype.hasOwnProperty.call(
        payloadWithAuthoredBlocks.reportDocument.blocks.find((block) => block.id === "primaryBuilder")?.state || {},
        "reportDocumentBlocks",
    ),
    false,
);
assert.deepEqual(payloadWithAuthoredBlocks.reportSpec.layoutIntent.blockOrder, [
    "overviewSection",
    "summaryPanel",
    "launchCallout",
    "sectionTabs",
    "directIntro",
    "narrativeIntro",
    "integrationFlow",
    "primaryTable",
    "headlineKpi",
    "publisherPipeline",
    "integrationTimeline",
]);

const reopenedPayloadFromResponse = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    documentVersion: 6,
    savedAt: 9300,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_channel_trend",
        sourceArtifactId: "capacity_q3_channel_trend",
    },
}, {
    container: {
        id: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        title: "Report Builder Demo",
        dataSourceRef: "demoReportSource",
    },
    config: {
        measures: [
            { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
            { id: "channelV2", key: "channelV2", label: "Channel", default: true },
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
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        chartSpec: {
            title: "Avails by Date and Channel",
            type: "area",
            xField: "eventDate",
            yFields: ["avails"],
            seriesField: "channelV2",
        },
        scopeParams: {
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
    },
    savedAt: 9500,
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
            { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
        ],
    },
});
assert.equal(reopenedPayloadFromResponse.reportDocument.id, "capacityTrendQ3");
assert.equal(reopenedPayloadFromResponse.reportDocument.title, "Capacity Trend Q3");
assert.equal(reopenedPayloadFromResponse.kind, "reportBuilder.savedReportPayload");
assert.equal(reopenedPayloadFromResponse.payloadId, "rbreport_capacity_q3_channel_trend");
assert.equal(reopenedPayloadFromResponse.sourceArtifactId, "capacity_q3_channel_trend");
assert.equal(resolvePrimaryBuilderState(reopenedPayloadFromResponse.reportDocument).viewMode, "table");
assert.equal(reopenedPayloadFromResponse.reportDocument.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(reopenedPayloadFromResponse.reportSpec.semanticSummary.entityLabel, "Line Delivery");

const calculationContainer = {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Report Builder Demo",
    dataSourceRef: "demoReportSource",
};

const calculationConfig = {
    measures: [
        { id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" },
        { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Event Date", default: true, chartAxis: true, format: "date" },
        { id: "channelV2", key: "channelV2", label: "Channel", default: true },
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
};

const hostedTemplateBackedSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_hosted_template_save",
    sourceArtifactId: "hosted_template_save",
    title: "Performance Inventory Brief",
    reportRef: {
        reportId: "performanceInventoryBrief",
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "performanceInventoryBrief",
        title: "Performance Inventory Brief",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "metricsCubeBuilder",
        stateKey: "metricsCubeBuilder",
        title: "Performance Metrics",
        dataSourceRef: "metrics_ad_cube_report",
    },
    config: calculationConfig,
    state: applyReportBuilderPersistedRuntimePreviewInteraction({
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["channelV2"],
        viewMode: "table",
        chartSpec: null,
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [],
        localTableCalculations: [],
        reportDocumentTitle: "Performance Inventory Brief",
        reportDocumentTemplateId: "performance_inventory_brief",
        reportDocumentTemplateLabel: "Performance Inventory Brief",
    }, {
        refinements: [
            {
                id: "keep:channelV2:primaryTable",
                op: "keep",
                field: "channelV2",
                values: ["CTV"],
                sourceBlockId: "primaryTable",
                label: "Keep Channel = CTV",
            },
        ],
    }),
    savedAt: 9755,
});
assert.equal(hostedTemplateBackedSavedPayload.title, "Performance Inventory Brief");
assert.equal(hostedTemplateBackedSavedPayload.sourceSession.sourceRef.kind, "reportBuilder.reportTemplate");
assert.equal(hostedTemplateBackedSavedPayload.sourceSession.sourceRef.templateId, "performance_inventory_brief");
assert.equal(hostedTemplateBackedSavedPayload.sourceSession.sourceRef.templateLabel, "Performance Inventory Brief");
assert.equal(hostedTemplateBackedSavedPayload.sourceSession.sourceRef.contextLabel, "Performance Inventory Brief");
assert.equal(hostedTemplateBackedSavedPayload.sourceSession.runtimePreviewInteraction.refinements[0].field, "channelV2");

const localCalcSeed = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_calc_persisted",
    savedAt: 9300,
    title: "Calculated Report",
    sourceArtifactId: "calc_persisted",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "calcPersisted",
        title: "Calculated Report",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const localCalcSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState(localCalcSeed, {
    container: calculationContainer,
    config: calculationConfig,
    state: {
        selectedMeasures: ["reachRate", "reachShare"],
        primaryMeasure: "reachRate",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "chart",
        chartSpec: {
            title: "Reach Rate by Date",
            type: "line",
            xField: "eventDate",
            yFields: ["reachRate"],
        },
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
    },
    savedAt: 9400,
});

assert.equal(resolvePrimaryBuilderState(localCalcSavedPayload.reportDocument).localCalculatedFields[0].id, "reachRate");
assert.equal(resolvePrimaryBuilderState(localCalcSavedPayload.reportDocument).localTableCalculations[0].id, "reachShare");
assert.equal(localCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(localCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);

const localCalcResponse = buildReportBuilderGetReportDocumentResponse(localCalcSavedPayload, {
    documentVersion: 7,
    savedAt: 9450,
});
const hydratedLocalCalc = buildHydratedReportBuilderDocument(localCalcResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});

assert.equal(hydratedLocalCalc.valid, true);
assert.equal(hydratedLocalCalc.state.localCalculatedFields[0].id, "reachRate");
assert.equal(hydratedLocalCalc.state.localTableCalculations[0].id, "reachShare");

const localCalcModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedLocalCalc.config,
    state: hydratedLocalCalc.state,
});
const localCalcPreview = buildReportBuilderRuntimePreview({
    model: localCalcModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 300, hhUniqs: 120 },
    ],
    hasMore: false,
});

assert.equal(localCalcPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[0].reachShare, 25);
assert.equal(localCalcPreview.reportFill.datasets[0].rows[1].reachShare, 75);
assert.equal(localCalcPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachRate"), true);
assert.equal(localCalcPreview.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "reachShare"), true);
const localCalcSavedRecord = buildReportBuilderSavedReportPayloadRecord(localCalcSavedPayload, {
    runtimeArtifact: localCalcPreview,
    documentVersion: 7,
});
assert.equal(localCalcSavedRecord.documentVersion, 7);
assert.equal(localCalcSavedRecord.savedReportPayload.payloadId, "rbreport_calc_persisted");
assert.equal(localCalcSavedRecord.exportRequest.source.from, "savedPayload");
assert.equal(localCalcSavedRecord.exportRequest.source.documentVersion, 7);
assert.equal(localCalcSavedRecord.exportRequest.reportPrint.title, "Calculated Report");

const dependentLocalCalcSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_dependent_calc_persisted",
    savedAt: 9401,
    title: "Dependent Calculated Report",
    sourceArtifactId: "dependent_calc_persisted",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "dependentCalcPersisted",
        title: "Dependent Calculated Report",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: calculationConfig,
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
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
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
    savedAt: 9402,
});

assert.equal(resolvePrimaryBuilderState(dependentLocalCalcSavedPayload.reportDocument).selectedMeasures[0], "runningCtvAvails");
assert.equal(resolvePrimaryBuilderState(dependentLocalCalcSavedPayload.reportDocument).localCalculatedFields[0].id, "ctvAvails");
assert.equal(resolvePrimaryBuilderState(dependentLocalCalcSavedPayload.reportDocument).localTableCalculations[0].id, "runningCtvAvails");
assert.equal(resolvePrimaryBuilderState(dependentLocalCalcSavedPayload.reportDocument).localTableCalculations[0].compute.sourceField, "ctvAvails");
assert.equal(dependentLocalCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "ctvAvails" && field.kind === "rowCalc"), true);
assert.equal(dependentLocalCalcSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "runningCtvAvails" && field.kind === "tableCalc"), true);
assert.equal(dependentLocalCalcSavedPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(dependentLocalCalcSavedPayload.reportSpec.datasets[0].request.measures.ctvAvails, undefined);
assert.equal(dependentLocalCalcSavedPayload.reportSpec.datasets[0].request.measures.runningCtvAvails, undefined);
assert.equal(dependentLocalCalcSavedPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);

const dependentLocalCalcResponse = buildReportBuilderGetReportDocumentResponse(dependentLocalCalcSavedPayload, {
    documentVersion: 8,
    savedAt: 9403,
});
const hydratedDependentLocalCalc = buildHydratedReportBuilderDocument(dependentLocalCalcResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});
assert.equal(hydratedDependentLocalCalc.valid, true);
assert.equal(hydratedDependentLocalCalc.state.selectedMeasures[0], "runningCtvAvails");
assert.equal(hydratedDependentLocalCalc.state.localCalculatedFields[0].id, "ctvAvails");
assert.equal(hydratedDependentLocalCalc.state.localTableCalculations[0].id, "runningCtvAvails");
assert.equal(hydratedDependentLocalCalc.state.localTableCalculations[0].compute.sourceField, "ctvAvails");

const dependentLocalCalcModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedDependentLocalCalc.config,
    state: hydratedDependentLocalCalc.state,
});
const dependentLocalCalcPreview = buildReportBuilderRuntimePreview({
    model: dependentLocalCalcModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 12000, hhUniqs: 2500 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 34300, hhUniqs: 14700 },
        { eventDate: "2026-05-03", channelV2: "CTV", avails: 36000, hhUniqs: 15200 },
    ],
    hasMore: false,
});
assert.equal(dependentLocalCalcPreview.reportFill.calculatedFields.some((field) => field.id === "ctvAvails"), true);
assert.equal(dependentLocalCalcPreview.reportFill.calculatedFields.some((field) => field.id === "runningCtvAvails"), true);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[0].ctvAvails, null);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[1].ctvAvails, 34300);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[2].ctvAvails, 36000);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[0].runningCtvAvails, 0);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[1].runningCtvAvails, 34300);
assert.equal(dependentLocalCalcPreview.reportFill.datasets[0].rows[2].runningCtvAvails, 70300);

const dependentLocalCalcSavedRecord = buildReportBuilderSavedReportPayloadRecord(dependentLocalCalcSavedPayload, {
    runtimeArtifact: dependentLocalCalcPreview,
    documentVersion: 8,
});
assert.equal(dependentLocalCalcSavedRecord.documentVersion, 8);
assert.equal(dependentLocalCalcSavedRecord.exportRequest.source.from, "savedPayload");
assert.equal(dependentLocalCalcSavedRecord.exportRequest.source.documentVersion, 8);
assert.equal(dependentLocalCalcSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "ctvAvails" && field.kind === "rowCalc"), true);
assert.equal(dependentLocalCalcSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "runningCtvAvails" && field.kind === "tableCalc"), true);
assert.equal(dependentLocalCalcSavedRecord.exportRequest.reportFill.datasets[0].rows[2].runningCtvAvails, 70300);
assert.equal(
    dependentLocalCalcSavedRecord.exportRequest.reportFill.blocks.find((block) => block.kind === "tableBlock")?.content?.columns?.some((column) => column.key === "runningCtvAvails"),
    true,
);

const authoredDerivedOnlySavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_authored_calc_runtime",
    savedAt: 9500,
    title: "Authored Derived Report",
    sourceArtifactId: "authored_calc_runtime",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "authoredCalcRuntime",
        title: "Authored Derived Report",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: calculationConfig,
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        chartSpec: null,
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails", "channelV2"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    partitionBy: ["channelV2"],
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
        reportDocumentBlocks: [
            {
                id: "reachRateChart",
                kind: "chartBlock",
                title: "Reach Rate by Date",
                datasetRef: "primary",
                chartSpec: {
                    title: "Reach Rate by Date",
                    type: "line",
                    xField: "eventDate",
                    yFields: ["reachRate"],
                    seriesField: "channelV2",
                },
            },
            {
                id: "reachShareTable",
                kind: "tableBlock",
                title: "Reach Share Table",
                datasetRef: "primary",
                columns: [
                    { key: "eventDate", label: "Event Date", format: "date" },
                    { key: "reachShare", label: "Reach Share", format: "percent" },
                ],
            },
            {
                id: "reachShareKpi",
                kind: "kpiBlock",
                title: "Reach Share KPI",
                datasetRef: "primary",
                valueField: "reachShare",
                valueLabel: "Reach Share",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "reachRateChart" },
                { blockId: "reachShareTable" },
                { blockId: "reachShareKpi" },
            ],
        },
    },
    savedAt: 9600,
});

assert.equal(authoredDerivedOnlySavedPayload.compileState.status, "clean");
assert.deepEqual(authoredDerivedOnlySavedPayload.compileState.diagnostics || [], []);
assert.deepEqual(resolvePrimaryBuilderState(authoredDerivedOnlySavedPayload.reportDocument).selectedMeasures, ["avails"]);
assert.equal(resolvePrimaryBuilderState(authoredDerivedOnlySavedPayload.reportDocument).localCalculatedFields[0].id, "reachRate");
assert.equal(resolvePrimaryBuilderState(authoredDerivedOnlySavedPayload.reportDocument).localTableCalculations[0].id, "reachShare");
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.dimensions.eventDate, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlySavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartModel?.series?.values?.[0]?.value, "reachRate");

const authoredDerivedOnlyResponse = buildReportBuilderGetReportDocumentResponse(authoredDerivedOnlySavedPayload, {
    documentVersion: 8,
    savedAt: 9650,
});
const hydratedAuthoredDerivedOnly = buildHydratedReportBuilderDocument(authoredDerivedOnlyResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});

assert.equal(hydratedAuthoredDerivedOnly.valid, true);
assert.equal(hydratedAuthoredDerivedOnly.compileState.status, "clean");
assert.deepEqual(hydratedAuthoredDerivedOnly.state.selectedMeasures, ["avails"]);
assert.equal(hydratedAuthoredDerivedOnly.state.localCalculatedFields[0].id, "reachRate");
assert.equal(hydratedAuthoredDerivedOnly.state.localTableCalculations[0].id, "reachShare");
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachRateChart" && block.kind === "chartBlock"), true);
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachShareTable" && block.kind === "tableBlock"), true);
assert.equal(hydratedAuthoredDerivedOnly.state.reportDocumentBlocks.some((block) => block.id === "reachShareKpi" && block.kind === "kpiBlock"), true);

const authoredDerivedOnlyModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedAuthoredDerivedOnly.config,
    state: hydratedAuthoredDerivedOnly.state,
});
assert.equal(authoredDerivedOnlyModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(authoredDerivedOnlyModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(authoredDerivedOnlyModel.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
const authoredDerivedOnlyPreview = buildReportBuilderRuntimePreview({
    model: authoredDerivedOnlyModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "CTV", avails: 300, hhUniqs: 120 },
    ],
    hasMore: false,
});

assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[0].reachShare, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.datasets[0].rows[1].reachShare, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 100);
assert.equal(authoredDerivedOnlyPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.secondaryValue, "Display");

const authoredDerivedOnlySavedRecord = buildReportBuilderSavedReportPayloadRecord(authoredDerivedOnlySavedPayload, {
    runtimeArtifact: authoredDerivedOnlyPreview,
    documentVersion: 8,
});
assert.equal(authoredDerivedOnlySavedRecord.documentVersion, 8);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.source.from, "savedPayload");
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.source.documentVersion, 8);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachShare"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.datasets[0].rows[0].reachShare, 100);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 100);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("reachRateChart")), true);
assert.equal(authoredDerivedOnlySavedRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachShare"), true);

const derivedTemplate = {
    id: "market_efficiency_brief",
    label: "Market Efficiency Brief",
    description: "Template-instantiated authored report that uses non-selected derived fields.",
    statePatch: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        chartSpec: null,
        scopeParams: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
        localCalculatedFields: [
            {
                id: "reachRate",
                key: "reachRate",
                kind: "rowCalc",
                label: "Reach Rate",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["hhUniqs", "avails"],
                expr: "if(avails = 0, null, round((hhUniqs / avails) * 100, 2))",
            },
        ],
        localTableCalculations: [
            {
                id: "reachShare",
                key: "reachShare",
                kind: "tableCalc",
                label: "Reach Share",
                dataType: "number",
                format: "percent",
                datasetRef: "primary",
                dependencies: ["avails", "channelV2"],
                compute: {
                    type: "percentOfTotal",
                    sourceField: "avails",
                    partitionBy: ["channelV2"],
                    scale: 100,
                    decimals: 2,
                },
            },
        ],
    },
    documentPatch: {
        title: "Market Efficiency Brief",
        subtitle: "Derived Authored Fields",
        description: "Template-instantiated authored report that binds chart, table, and KPI blocks to non-selected derived fields.",
        blocks: [
            {
                id: "reachRateChart",
                kind: "chartBlock",
                title: "Reach Rate by Date",
                datasetRef: "primary",
                chartSpec: {
                    title: "Reach Rate by Date",
                    type: "line",
                    xField: "eventDate",
                    yFields: ["reachRate"],
                    seriesField: "channelV2",
                },
            },
            {
                id: "reachShareTable",
                kind: "tableBlock",
                title: "Reach Share Table",
                datasetRef: "primary",
                columns: [
                    { key: "eventDate", label: "Event Date", format: "date" },
                    { key: "reachShare", label: "Reach Share", format: "percent" },
                ],
            },
            {
                id: "reachShareKpi",
                kind: "kpiBlock",
                title: "Reach Share KPI",
                datasetRef: "primary",
                valueField: "reachShare",
                valueLabel: "Reach Share",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
        layout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "reachRateChart" },
                { blockId: "reachShareTable" },
                { blockId: "reachShareKpi" },
            ],
        },
    },
};

const instantiatedDerivedTemplate = instantiateReportBuilderDocumentTemplate(calculationConfig, derivedTemplate);
assert.equal(instantiatedDerivedTemplate.valid, true);
assert.deepEqual(instantiatedDerivedTemplate.nextState.selectedMeasures, ["avails"]);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(instantiatedDerivedTemplate.nextState.localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(instantiatedDerivedTemplate.nextState.localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachRateChart"), true);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachShareTable"), true);
assert.equal(instantiatedDerivedTemplate.nextState.reportDocumentBlocks.some((block) => block.id === "reachShareKpi"), true);

const templatedDerivedSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_template_derived_runtime",
    savedAt: 9700,
    title: "Market Efficiency Brief",
    sourceArtifactId: "template_derived_runtime",
    sourceSession: {
        sessionId: "rbexplore_market_efficiency_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "market_efficiency_brief",
            templateLabel: "Market Efficiency Brief",
            contextLabel: "Market Efficiency Brief",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "marketEfficiencyBrief",
        title: "Market Efficiency Brief",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: calculationConfig,
    state: instantiatedDerivedTemplate.nextState,
    savedAt: 9750,
});

assert.equal(templatedDerivedSavedPayload.compileState.status, "clean");
assert.deepEqual(templatedDerivedSavedPayload.compileState.diagnostics || [], []);
assert.deepEqual(resolvePrimaryBuilderState(templatedDerivedSavedPayload.reportDocument).selectedMeasures, ["avails"]);
assert.equal(resolvePrimaryBuilderState(templatedDerivedSavedPayload.reportDocument).reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(resolvePrimaryBuilderState(templatedDerivedSavedPayload.reportDocument).reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(resolvePrimaryBuilderState(templatedDerivedSavedPayload.reportDocument).localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(resolvePrimaryBuilderState(templatedDerivedSavedPayload.reportDocument).localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(templatedDerivedSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachRate" && field.kind === "rowCalc"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.calculatedFields.some((field) => field.id === "reachShare" && field.kind === "tableCalc"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.avails, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.reachRate, undefined);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.measures.reachShare, undefined);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.dimensions.eventDate, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachShareTable")?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedSavedPayload.reportSpec.blocks.find((block) => block.id === "reachShareKpi")?.valueField, "reachShare");

const templatedDerivedResponse = buildReportBuilderGetReportDocumentResponse(templatedDerivedSavedPayload, {
    documentVersion: 9,
    savedAt: 9800,
});
const hydratedTemplatedDerived = buildHydratedReportBuilderDocument(templatedDerivedResponse, {
    container: calculationContainer,
    builderIdentity: {
        containerId: calculationContainer.id,
        stateKey: calculationContainer.stateKey,
        dataSourceRef: calculationContainer.dataSourceRef,
    },
});
assert.equal(hydratedTemplatedDerived.valid, true);
assert.equal(hydratedTemplatedDerived.compileState.status, "clean");
assert.deepEqual(hydratedTemplatedDerived.state.selectedMeasures, ["avails"]);
assert.equal(hydratedTemplatedDerived.state.reportDocumentTemplateId, "market_efficiency_brief");
assert.equal(hydratedTemplatedDerived.state.reportDocumentTemplateLabel, "Market Efficiency Brief");
assert.deepEqual(hydratedTemplatedDerived.state.localCalculatedFields, derivedTemplate.statePatch.localCalculatedFields);
assert.deepEqual(hydratedTemplatedDerived.state.localTableCalculations, derivedTemplate.statePatch.localTableCalculations);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachRateChart"), true);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachShareTable"), true);
assert.equal(hydratedTemplatedDerived.state.reportDocumentBlocks.some((block) => block.id === "reachShareKpi"), true);

const templatedDerivedModel = buildReportBuilderRuntimePreviewModel({
    container: calculationContainer,
    config: hydratedTemplatedDerived.config,
    state: hydratedTemplatedDerived.state,
});
assert.equal(templatedDerivedModel.reportSpec.datasets[0].request.measures.hhUniqs, true);
assert.equal(templatedDerivedModel.reportSpec.datasets[0].request.dimensions.channelV2, true);
assert.equal(templatedDerivedModel.reportSpec.blocks.find((block) => block.id === "reachRateChart")?.chartSpec?.seriesField, "channelV2");
const templatedDerivedPreview = buildReportBuilderRuntimePreview({
    model: templatedDerivedModel,
    rows: [
        { eventDate: "2026-05-01", channelV2: "Display", avails: 100, hhUniqs: 25 },
        { eventDate: "2026-05-02", channelV2: "Display", avails: 300, hhUniqs: 120 },
        { eventDate: "2026-05-03", channelV2: "CTV", avails: 50, hhUniqs: 20 },
        { eventDate: "2026-05-04", channelV2: "CTV", avails: 150, hhUniqs: 60 },
    ],
    hasMore: false,
});
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[0].reachRate, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[1].reachRate, 40);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[0].reachShare, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[1].reachShare, 75);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[2].reachShare, 25);
assert.equal(templatedDerivedPreview.reportFill.datasets[0].rows[3].reachShare, 75);
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartModel?.series?.values?.[0]?.value, "reachRate");
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.valueField, "reachShare");
assert.equal(templatedDerivedPreview.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 25);

const rebuiltTemplatedDerivedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_template_derived_runtime",
    savedAt: 9700,
    title: "Market Efficiency Brief",
    sourceArtifactId: "template_derived_runtime",
    sourceSession: {
        sessionId: "rbexplore_market_efficiency_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "market_efficiency_brief",
            templateLabel: "Market Efficiency Brief",
            contextLabel: "Market Efficiency Brief",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "marketEfficiencyBrief",
        title: "Market Efficiency Brief",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: calculationContainer,
    config: hydratedTemplatedDerived.config,
    state: hydratedTemplatedDerived.state,
    savedAt: 9850,
});
assert.deepEqual(rebuiltTemplatedDerivedPayload.reportDocument, templatedDerivedSavedPayload.reportDocument);
assert.deepEqual(rebuiltTemplatedDerivedPayload.reportSpec, templatedDerivedSavedPayload.reportSpec);
assert.deepEqual(rebuiltTemplatedDerivedPayload.compileState, templatedDerivedSavedPayload.compileState);

const templatedDerivedSavedRecord = buildReportBuilderSavedReportPayloadRecord(templatedDerivedSavedPayload, {
    runtimeArtifact: templatedDerivedPreview,
    documentVersion: 9,
});
assert.equal(templatedDerivedSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachRate"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportSpec.calculatedFields.some((field) => field.id === "reachShare"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachRateChart")?.content?.chartSpec?.seriesField, "channelV2");
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareTable")?.content?.columns?.some((column) => column.key === "reachShare"), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportFill.blocks.find((block) => block.id === "reachShareKpi")?.content?.value, 25);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportPrint.pages[0].elements.some((element) => element.kind === "svg" && element.id.includes("reachRateChart")), true);
assert.equal(templatedDerivedSavedRecord.exportRequest.reportPrint.pages.flatMap((page) => page.elements || []).some((element) => element.kind === "tableCellText" && element.columnKey === "reachShare"), true);

console.log("reportBuilderSavedReportPayload ✓ derives saved report payloads from exploration artifacts");
