import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderDocumentVersionState,
    buildReportBuilderGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseFromBuilderState,
    mergeReportBuilderGetReportDocumentResponseSharedArtifact,
    buildReportBuilderSelectedGetReportDocumentResponseFromSharedArtifact,
    buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseSummary,
    buildReportBuilderListReportDocumentsEntryOptionLabel,
    buildReportBuilderListReportDocumentsEntryMetaChips,
    buildReportBuilderListReportDocumentsEntryNotice,
    buildReportBuilderListReportDocumentsEntryOptions,
    buildReportBuilderListReportDocumentsEntrySelectionKey,
    buildReportBuilderListReportDocumentsEntrySummary,
    buildReportBuilderListReportDocumentsResponse,
    buildReportBuilderListReportDocumentsResponseFromSavedRecords,
    buildReportBuilderListReportDocumentsResponseFromBuilderState,
    buildReportBuilderListReportDocumentsResponseSummary,
    buildReportBuilderReportDocumentReadResponseInspectorState,
    buildReportBuilderReportDocumentReadResponseDownload,
    resolveReportBuilderDocumentVersion,
    resolveReportBuilderReportDocumentResponseSeed,
    serializeReportBuilderReportDocumentReadResponse,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    buildHydratedReportBuilderDocument,
    buildReportBuilderHydratedDocumentSession,
} from "./reportBuilderHydratedReportDocument.js";
import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const savedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
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

const carriedSemanticSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_carried_semantic",
    sourceArtifactId: "carried_semantic",
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
    semanticBindingViewState: carriedSemanticBindingViewState,
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "carriedSemantic",
        title: "Carried Semantic",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const invalidSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_invalid_authored_blocks",
    sourceArtifactId: "invalid_authored_blocks",
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
                    dimensions: [
                        { id: "channelV2", key: "channelV2", label: "Channel" },
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
};

const capacitySavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_inventory_ladder",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    sourceSession: {
        sessionId: "rbexplore_capacityQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
            contextLabel: "Capacity Q3 • Inventory Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityQ3",
        title: "Capacity Q3",
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

const capacityLocationSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_location_ladder",
    sourceArtifactId: "capacity_q3_location_ladder",
    sourceSession: {
        sessionId: "rbexplore_capacityLocationQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "capacity_location_brief",
            templateLabel: "Capacity Location Brief",
            contextLabel: "Capacity Location Q3 • Location Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityLocationQ3",
        title: "Capacity Location Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_location_brief",
                    reportDocumentTemplateLabel: "Capacity Location Brief",
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

const capacityTrendSavedReportPayload = {
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
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

const capacityInventoryTopChannelsSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_inventory_top_channels",
    sourceArtifactId: "capacity_q3_inventory_top_channels",
    sourceSession: {
        sessionId: "rbexplore_capacityInventoryTopChannelsQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
            contextLabel: "Capacity Inventory Top Channels Q3 • Inventory · Top Channels",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityInventoryTopChannelsQ3",
        title: "Capacity Inventory Top Channels Q3",
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
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

const capacityLocationsTopMarketsSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3_locations_top_markets",
    sourceArtifactId: "capacity_q3_locations_top_markets",
    sourceSession: {
        sessionId: "rbexplore_capacityLocationsTopMarketsQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "capacity_location_brief",
            templateLabel: "Capacity Location Brief",
            contextLabel: "Capacity Locations Top Markets Q3 • Locations · Top Markets",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityLocationsTopMarketsQ3",
        title: "Capacity Locations Top Markets Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_location_brief",
                    reportDocumentTemplateLabel: "Capacity Location Brief",
                },
            },
        ],
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

const templatedSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_inventory_brief",
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
        subtitle: "Q2 Channel Ladder",
        description: "Capacity-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
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

assert.equal(resolveReportBuilderDocumentVersion("11"), 11);
assert.equal(resolveReportBuilderDocumentVersion(""), 0);

assert.deepEqual(buildReportBuilderDocumentVersionState("11"), {
    draft: "11",
    documentVersion: 11,
    valid: true,
    helperText: "Using document version 11.",
});

const getResponse = buildReportBuilderGetReportDocumentResponse(savedReportPayload, {
    documentVersion: "11",
    savedAt: 9000,
});
assert.deepEqual(getResponse, {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    savedAt: 9000,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
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
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
        sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    },
});

const semanticSpecSavedReportPayload = {
    ...savedReportPayload,
    reportSpec: {
        ...savedReportPayload.reportSpec,
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    },
};

assert.deepEqual(buildReportBuilderGetReportDocumentResponse(semanticSpecSavedReportPayload, {
    documentVersion: 11,
    savedAt: 9001,
})?.reportSpec?.semanticSummary, {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Canonical Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Canonical Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
    ],
    selectedMeasures: [
        { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
    ],
});

const semanticSpecListResponse = buildReportBuilderListReportDocumentsResponse(semanticSpecSavedReportPayload, {
    documentVersion: 11,
    savedAt: 9002,
});

assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(semanticSpecListResponse.entries[0]), {
    reportId: "demoReportBuilder",
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    documentVersion: 11,
    compileStatus: "clean",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Canonical Ad Delivery",
        "Entity Canonical Line Delivery",
        "Dimensions Canonical Delivery Date",
        "Measures Canonical Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
});

const directSemanticListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "semanticCatalogEntry" },
            documentVersion: 3,
            title: "Semantic Catalog Entry",
            subtitle: "Direct list payload",
            description: "Semantic metadata is carried directly on the list entry.",
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                },
                scope: {
                    params: [
                        {
                            id: "dateRange",
                            label: "Reporting Window",
                            description: "Direct list entry scope.",
                        },
                    ],
                },
                semanticSummary: {
                    kind: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    modelLabel: "Direct Ad Delivery",
                    entity: "line_delivery",
                    entityLabel: "Direct Line Delivery",
                    selectedDimensions: [
                        {
                            id: "event_date",
                            rawId: "eventDate",
                            label: "Delivery Date",
                            category: "Time",
                            governance: {
                                status: "approved",
                                certification: "reviewed",
                                ownerRef: "team://example/performance",
                            },
                        },
                    ],
                    selectedMeasures: [
                        {
                            id: "available_impressions",
                            rawId: "avails",
                            label: "Available Impressions",
                            category: "Metrics",
                            governance: {
                                ownerRef: "team://example/performance",
                            },
                        },
                    ],
                    selectedParameters: [
                        {
                            id: "dateRange",
                            rawId: "dateRange",
                            label: "Reporting Window",
                            category: "Scope",
                            governance: {
                                ownerRef: "team://example/performance",
                            },
                        },
                    ],
                },
            },
        },
    ],
    cursor: "",
    hasMore: false,
};

assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(semanticSpecListResponse, semanticSpecSavedReportPayload, {
    request: {
        reportRef: {
            reportId: "demoReportBuilder",
        },
    },
    savedAt: 9003,
})?.reportSpec?.semanticSummary, {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Canonical Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Canonical Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
    ],
    selectedMeasures: [
        { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
    ],
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(semanticSpecListResponse.entries[0], {
    localSavedPayloads: [
        {
            documentVersion: 11,
            savedAt: 9002,
            savedReportPayload: semanticSpecSavedReportPayload,
        },
    ],
}), {
    reportId: "demoReportBuilder",
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    documentVersion: 11,
    compileStatus: "clean",
    reopenable: true,
    backingState: "reopen-ready",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Canonical Ad Delivery",
        "Entity Canonical Line Delivery",
        "Dimensions Canonical Delivery Date",
        "Measures Canonical Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(directSemanticListResponse.entries[0]), {
    reportId: "semanticCatalogEntry",
    title: "Semantic Catalog Entry",
    subtitle: "Direct list payload",
    description: "Semantic metadata is carried directly on the list entry.",
    documentVersion: 3,
    compileStatus: "",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Direct Ad Delivery",
        "Entity Direct Line Delivery",
        "Dimensions Delivery Date",
        "Measures Available Impressions",
        "Parameters Reporting Window",
        "Categories Time, Metrics +1",
        "Owner team://example/performance",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "event_date",
                    rawId: "eventDate",
                    label: "Delivery Date",
                    category: "Time",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "available_impressions",
                    rawId: "avails",
                    label: "Available Impressions",
                    category: "Metrics",
                    governance: {
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                {
                    id: "dateRange",
                    rawId: "dateRange",
                    label: "Reporting Window",
                    category: "Scope",
                    governance: {
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Direct list entry scope.",
        },
    ],
});

const derivedListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
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
        blocks: [{ id: "primaryBuilder" }],
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
            defaultMode: "table",
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
                    { id: "event_date", label: "Delivery Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticProviderDiagnostics",
            severity: "warning",
            message: "The semantic provider returned 1 diagnostic for the current selection.",
        },
    ],
    documentVersion: 11,
    cursor: "next-page",
    hasMore: true,
});

assert.equal(derivedListResponse.entries[0].title, "Semantic Runtime Demo");
assert.equal(derivedListResponse.entries[0].compileState.reportSpecVersion, 1);
assert.equal(derivedListResponse.entries[0].compileState.diagnostics[0].code, "semanticProviderDiagnostics");
assert.equal(derivedListResponse.entries[0].source.payloadId, "rbreport_semantic_runtime");

const derivedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    derivedListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "semanticRuntimeDemo",
        },
        documentVersion: 11,
        savedAt: 9410,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "semanticRuntimeDemo",
            title: "Semantic Runtime Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_semantic_runtime",
            sourceArtifactId: "semantic_runtime_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "semanticRuntimeDemo",
            },
        },
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
                defaultMode: "table",
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
        },
        semanticModel: {
            modelRef: "model://example/performance/delivery@v1",
            version: 1,
            label: "Ad Delivery",
            entities: [
                {
                    id: "line_delivery",
                    label: "Line Delivery",
                    dimensions: [
                        { id: "event_date", label: "Delivery Date" },
                        { id: "channel", label: "Channel" },
                    ],
                    measures: [
                        { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                    ],
                },
            ],
        },
        semanticRuntimeDiagnostics: [
            {
                code: "semanticProviderDiagnostics",
                severity: "warning",
                message: "Selected get response semantic provider diagnostic.",
            },
        ],
    },
);

assert.equal(derivedSelectedGetResponse.source.kind, "reportBuilder.savedReportPayload");
assert.equal(derivedSelectedGetResponse.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedSelectedGetResponse.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(derivedSelectedGetResponse.compileState.status, "clean");
assert.equal(derivedSelectedGetResponse.compileState.diagnostics[0].code, "semanticProviderDiagnostics");
assert.equal(derivedSelectedGetResponse.compileState.diagnostics[0].message, "Selected get response semantic provider diagnostic.");

const audienceGetResponse = audienceArtifactFixture.getReportDocumentResponse;
assert.equal(audienceGetResponse.reportSpec.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(audienceGetResponse.reportSpec.semanticSummary.selectedMeasures[0].category, "Audience");
assert.equal(audienceGetResponse.reportSpec.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(audienceGetResponse.reportSpec.semanticSummary.selectedParameters[1].category, "Audience");

const audienceListResponse = audienceArtifactFixture.listReportDocumentsResponse;
const audienceListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(audienceListResponse.entries[0], {
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9379,
            savedReportPayload: audienceArtifactFixture.savedReportPayload,
        },
    ],
});
assert.equal(audienceListEntrySummary.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceListEntrySummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceListEntrySummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(audienceListEntrySummary.authoredBlockCount, 4);
assert.equal(audienceListEntrySummary.authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(audienceListEntrySummary.drillHierarchyCount, 2);
assert.equal(audienceListEntrySummary.detailTargetCount, 2);
assert.equal(audienceListEntrySummary.drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");

const audienceDocumentOnlyGetResponse = {
    ...audienceArtifactFixture.getReportDocumentResponse,
};
delete audienceDocumentOnlyGetResponse.reportSpec;
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(audienceDocumentOnlyGetResponse).scopeSummaryText,
    "Date Range • Channels • Audience Segment",
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(audienceDocumentOnlyGetResponse).semanticBindingChips.includes("Measures Audience Index"),
    true,
);

const audienceDocumentOnlySavedPayload = {
    ...audienceArtifactFixture.savedReportPayload,
};
delete audienceDocumentOnlySavedPayload.reportSpec;
const audienceDocumentOnlyListResponse = buildReportBuilderListReportDocumentsResponse(audienceDocumentOnlySavedPayload, {
    documentVersion: 13,
    savedAt: 9379,
});
const audienceDocumentOnlyListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    audienceDocumentOnlyListResponse.entries[0],
    {
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9379,
                savedReportPayload: audienceDocumentOnlySavedPayload,
            },
        ],
    },
);
assert.equal(audienceDocumentOnlyListEntrySummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceDocumentOnlyListEntrySummary.semanticBindingChips.includes("Measures Audience Index"),
    true,
);

const audienceLegacySavedPayloadListResponse = buildReportBuilderListReportDocumentsResponse(
    audienceArtifactFixture.legacySavedReportPayload,
    {
        documentVersion: 13,
        savedAt: 9379,
    },
);
const audienceLegacySavedPayloadListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    audienceLegacySavedPayloadListResponse.entries[0],
);
assert.equal(audienceLegacySavedPayloadListEntrySummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceLegacySavedPayloadListEntrySummary.semanticBindingChips.includes("Measures Audience Index"),
    true,
);
assert.equal(
    audienceLegacySavedPayloadListEntrySummary.semanticBindingChips.includes("Parameters Date Range, Audience Segment"),
    true,
);

const audienceLegacyBackfilledListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    {
        reportRef: { reportId: "capacityAudienceSegmentIndexQ3" },
        documentVersion: 13,
        title: "Capacity Audience Segment Index Q3",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_audience_segment_index_q3",
            sourceArtifactId: "capacity_audience_segment_index_q3",
        },
    },
    {
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9379,
                importedArtifactKind: "reportBuilder.savedReportPayload",
                savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
            },
        ],
    },
);
assert.equal(audienceLegacyBackfilledListEntrySummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceLegacyBackfilledListEntrySummary.semanticBindingChips.includes("Measures Audience Index"),
    true,
);
assert.equal(
    audienceLegacyBackfilledListEntrySummary.semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    true,
);

const structurallyThinAudienceListEntry = {
    reportRef: { reportId: "capacityAudienceSegmentIndexQ3" },
    documentVersion: 13,
    title: "Capacity Audience Segment Index Q3",
    semanticSummary: {
        kind: "semantic",
        selectedDimensions: [],
        selectedMeasures: [],
        selectedParameters: [],
    },
    scope: {
        params: [],
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_audience_segment_index_q3",
        sourceArtifactId: "capacity_audience_segment_index_q3",
    },
};
const structurallyThinAudienceListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    structurallyThinAudienceListEntry,
    {
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9379,
                importedArtifactKind: "reportBuilder.savedReportPayload",
                savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
            },
        ],
    },
);
assert.equal(structurallyThinAudienceListEntrySummary.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    structurallyThinAudienceListEntrySummary.semanticBindingChips.includes("Measures Audience Index"),
    true,
);
assert.equal(
    structurallyThinAudienceListEntrySummary.semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    true,
);
assert.equal(
    buildReportBuilderReportDocumentReadResponseInspectorState({
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [structuredClone(structurallyThinAudienceListEntry)],
        cursor: "",
        hasMore: false,
    }, {
        selectedReportId: "capacityAudienceSegmentIndexQ3",
        localSavedPayloads: [
            {
                documentVersion: 13,
                savedAt: 9379,
                importedArtifactKind: "reportBuilder.savedReportPayload",
                savedReportPayload: audienceArtifactFixture.legacySavedReportPayload,
            },
        ],
    }).semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const bindingOnlyGetResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "bindingOnlyTrendQ3" },
    documentVersion: 4,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "bindingOnlyTrendQ3",
        title: "Binding Only Trend Q3",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
};
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(bindingOnlyGetResponse).semanticBindingChips.includes("Dimensions event_date, channel"),
    true,
);
assert.equal(
    buildReportBuilderReportDocumentReadResponseInspectorState(bindingOnlyGetResponse).semanticBindingChips.includes("Measures available_impressions"),
    true,
);

const bindingOnlyListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "bindingOnlyTrendQ3" },
            documentVersion: 4,
            title: "Binding Only Trend Q3",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "bindingOnlyTrendQ3",
                binding: {
                    mode: "semantic",
                    modelRef: "model://example/performance/delivery@v1",
                    entity: "line_delivery",
                    selectedDimensions: ["event_date", "channel"],
                    selectedMeasures: ["available_impressions"],
                },
            },
        },
    ],
    cursor: "",
    hasMore: false,
};
assert.equal(
    buildReportBuilderListReportDocumentsEntrySummary(bindingOnlyListResponse.entries[0]).semanticBindingChips.includes("Dimensions event_date, channel"),
    true,
);

const embeddedDocumentOnlyGetResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: { reportId: "embeddedBindingTrendQ3" },
    documentVersion: 4,
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
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", format: "compactNumber" },
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
                    selectedDimensions: ["eventDate", "channelV2"],
                    selectedMeasures: ["avails"],
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
};
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(embeddedDocumentOnlyGetResponse).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(embeddedDocumentOnlyGetResponse).scopeSummaryText,
    "Reporting Window",
);
assert.equal(
    buildReportBuilderReportDocumentReadResponseInspectorState(embeddedDocumentOnlyGetResponse).semanticBindingChips.includes("Measures Available Impressions"),
    true,
);

const embeddedDocumentEmptySpecGetResponse = {
    ...embeddedDocumentOnlyGetResponse,
    reportSpec: {},
};
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(embeddedDocumentEmptySpecGetResponse).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(embeddedDocumentEmptySpecGetResponse).scopeSummaryText,
    "Reporting Window",
);
assert.equal(
    buildReportBuilderReportDocumentReadResponseInspectorState(embeddedDocumentEmptySpecGetResponse).semanticBindingChips.includes("Measures Available Impressions"),
    true,
);

const embeddedDocumentOnlyListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "embeddedBindingTrendQ3" },
            documentVersion: 4,
            title: "Embedded Binding Trend Q3",
            document: embeddedDocumentOnlyGetResponse.document,
        },
    ],
    cursor: "",
    hasMore: false,
};
assert.equal(
    buildReportBuilderListReportDocumentsEntrySummary(embeddedDocumentOnlyListResponse.entries[0]).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderListReportDocumentsEntrySummary(embeddedDocumentOnlyListResponse.entries[0]).scopeSummaryText,
    "Reporting Window",
);

const embeddedDocumentEmptySpecListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "embeddedBindingTrendQ3" },
            documentVersion: 4,
            title: "Embedded Binding Trend Q3",
            reportSpec: {},
            document: embeddedDocumentOnlyGetResponse.document,
        },
    ],
    cursor: "",
    hasMore: false,
};
assert.equal(
    buildReportBuilderListReportDocumentsEntrySummary(embeddedDocumentEmptySpecListResponse.entries[0]).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderListReportDocumentsEntrySummary(embeddedDocumentEmptySpecListResponse.entries[0]).scopeSummaryText,
    "Reporting Window",
);

const hydratedDerivedSelectedGetResponse = buildHydratedReportBuilderDocument(derivedSelectedGetResponse, {
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
assert.equal(hydratedDerivedSelectedGetResponse.valid, true);
const derivedSelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedDerivedSelectedGetResponse, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
});
assert.equal(derivedSelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.equal(derivedSelectedGetSession?.reopenedSemanticSummary?.entityLabel, "Line Delivery");
assert.equal(derivedSelectedGetSession?.reopenedSemanticFingerprint, JSON.stringify({
    modelRef: "model://example/performance/delivery@v1",
    selection: {
        entity: "line_delivery",
        dimensions: ["event_date", "channel"],
        measures: ["available_impressions"],
        parameters: {},
    },
}));
assert.equal(derivedSelectedGetSession?.reopenedCompileState?.status, "clean");
assert.equal(derivedSelectedGetSession?.reopenedCompileState?.diagnostics?.[0]?.message, "Selected get response semantic provider diagnostic.");

const seededGetResponseList = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    savedAt: 9300,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
        sourceArtifactId: "rbexploration_rbexplore_1000_5000",
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
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        staticFilters: {
            dateRange: {
                start: "2026-05-01",
                end: "2026-05-04",
            },
        },
    },
    documentVersion: 11,
    localSavedPayloads: [savedReportPayload],
});

assert.equal(seededGetResponseList.entries[0].source.kind, "reportBuilder.savedReportPayload");
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse(seededGetResponseList, [savedReportPayload], {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
})?.source?.kind, "reportBuilder.savedReportPayload");
assert.deepEqual(resolveReportBuilderReportDocumentResponseSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        documentVersion: 6,
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
        },
        grants: [
            { principalRef: "team://finance", role: "viewer" },
        ],
        savedSource: {
            kind: "reportBuilder.savedView",
            sourceArtifactId: "saved_view_capacity_trend",
            reportId: "capacityTrendQ3",
        },
    },
    getReportDocumentResponse: null,
}), {
    version: 1,
    kind: "getReportDocumentResponse",
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
    },
    grants: [
        { principalRef: "team://finance", role: "viewer" },
    ],
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
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_capacity_trend",
        reportId: "capacityTrendQ3",
    },
});
assert.deepEqual(resolveReportBuilderReportDocumentResponseSeed(savedReportPayload, {
    hydratedReportDocumentSession: null,
    getReportDocumentResponse: null,
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderReportDocumentResponseSeed(savedReportPayload, {
    hydratedReportDocumentSession: {},
    getReportDocumentResponse: null,
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderReportDocumentResponseSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_fallback_source",
            sourceArtifactId: "fallback_source_artifact",
        },
    },
    getReportDocumentResponse: null,
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_fallback_source",
        sourceArtifactId: "fallback_source_artifact",
    },
});
assert.deepEqual(resolveReportBuilderReportDocumentResponseSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "capacityTrendQ3",
        },
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendQ3",
            title: "Capacity Trend Q3",
        },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
});

const derivedGetResponse = buildReportBuilderGetReportDocumentResponseFromBuilderState({
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
            defaultMode: "table",
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
                    { id: "event_date", label: "Delivery Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
    semanticRuntimeDiagnostics: [
        {
            code: "semanticProviderDiagnostics",
            severity: "warning",
            message: "The semantic provider returned 1 diagnostic for the current selection.",
        },
    ],
    documentVersion: 11,
});

assert.equal(derivedGetResponse.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedGetResponse.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(derivedGetResponse.reportSpec.semanticSummary.selectedMeasures[0].label, "Available Impressions");
assert.equal(derivedGetResponse.compileState.diagnostics[0].code, "semanticProviderDiagnostics");

const carriedSemanticGetResponse = buildReportBuilderGetReportDocumentResponse(
    carriedSemanticSavedReportPayload,
    {
        documentVersion: 3,
        savedAt: 6200,
    },
);
assert.deepEqual(carriedSemanticGetResponse.semanticBindingViewState, carriedSemanticBindingViewState);
const carriedSemanticGetResponseSummary = buildReportBuilderGetReportDocumentResponseSummary(carriedSemanticGetResponse);
assert.equal(carriedSemanticGetResponseSummary.semanticBindingChips.includes("Model Carried Delivery"), true);
assert.deepEqual(
    carriedSemanticGetResponseSummary.semanticBindingFieldGroups,
    carriedSemanticBindingViewState.fieldGroups,
);
assert.deepEqual(carriedSemanticGetResponseSummary.shareableMetaChips, [
    "published",
    "v3",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Can View",
    "Can Export",
    "1 grant",
]);

assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(getResponse), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    kind: "getReportDocumentResponse",
    reportId: "demoReportBuilder",
    documentVersion: 11,
    compileStatus: "clean",
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary({
    ...getResponse,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report",
        reportId: "demoReportBuilder",
    },
    savedViewOverlay: {
        baseReportRef: {
            artifactRef: "report://demoReportBuilder",
            reportId: "demoReportBuilder",
            documentVersion: 10,
        },
        publishedSnapshotRef: {
            artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_demo_report",
            reportId: "demoReportBuilder",
            documentVersion: 11,
            sourceArtifactId: "published_snapshot_demo_report",
        },
        overlay: {
            filters: {
                channelsFilter: ["CTV"],
            },
        },
    },
}, {
    localSavedPayloads: [
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Base",
            documentVersion: 10,
            document: getResponse.document,
            reportSpec: getResponse.reportSpec,
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "demo_report_base",
                reportId: "demoReportBuilder",
            },
        },
        {
            reportId: "demoReportBuilder",
            title: "Exploration Demo Snapshot",
            documentVersion: 11,
            document: getResponse.document,
            reportSpec: getResponse.reportSpec,
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_demo_report",
                reportId: "demoReportBuilder",
            },
        },
    ],
}).reopenSourceResolutionChips, [
    "Published snapshot published_snapshot_demo_report • demoReportBuilder",
    "Base report file demo_report_base • demoReportBuilder",
]);
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(derivedGetResponse), {
    title: "Semantic Runtime Demo",
    kind: "getReportDocumentResponse",
    reportId: "semanticRuntimeDemo",
    documentVersion: 11,
    compileStatus: "clean",
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
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", format: "date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "dateRange",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "dateRange",
        },
    ],
});
const templatedGetResponse = buildReportBuilderGetReportDocumentResponse(templatedSavedReportPayload, {
    documentVersion: 11,
    savedAt: 9000,
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(templatedGetResponse), {
    title: "Capacity Inventory Brief",
    subtitle: "Q2 Channel Ladder",
    description: "Capacity-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    kind: "getReportDocumentResponse",
    reportId: "capacityInventoryBrief",
    documentVersion: 11,
    compileStatus: "clean",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
const audienceGetResponseSummary = buildReportBuilderGetReportDocumentResponseSummary(
    audienceArtifactFixture.getReportDocumentResponse,
);
assert.equal(audienceGetResponseSummary.authoredBlockCount, 4);
assert.equal(audienceGetResponseSummary.authoredBlockSummaryText, "4 authored blocks: 1 Filter Bar, 1 Kpi, 1 Refinement Bar, 1 Table");
assert.equal(audienceGetResponseSummary.drillHierarchyCount, 2);
assert.equal(audienceGetResponseSummary.detailTargetCount, 2);
assert.equal(audienceGetResponseSummary.drillSummaryText, "2 drill hierarchies • 6 levels • 2 detail targets • 3 field actions");

assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(getResponse), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    kind: "getReportDocumentResponse",
    reportId: "demoReportBuilder",
    documentVersion: 11,
    compileStatus: "clean",
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(getResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(derivedGetResponse), {
    title: "Semantic Runtime Demo",
    kind: "getReportDocumentResponse",
    reportId: "semanticRuntimeDemo",
    documentVersion: 11,
    compileStatus: "clean",
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
                { id: "event_date", rawId: "eventDate", label: "Delivery Date", format: "date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "dateRange",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "dateRange",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(derivedGetResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(templatedGetResponse), {
    title: "Capacity Inventory Brief",
    subtitle: "Q2 Channel Ladder",
    description: "Capacity-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    headerSubtitle: "Q2 Channel Ladder",
    headerDescription: "Capacity-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    kind: "getReportDocumentResponse",
    reportId: "capacityInventoryBrief",
    documentVersion: 11,
    compileStatus: "clean",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    content: serializeReportBuilderReportDocumentReadResponse(templatedGetResponse),
});
assert.equal(
    buildReportBuilderGetReportDocumentResponse(invalidSavedReportPayload, {
        documentVersion: "5",
    })?.compileState?.status,
    "clean",
);
assert.equal(
    buildReportBuilderGetReportDocumentResponse(invalidSavedReportPayload, {
        documentVersion: "5",
    })?.compileState?.diagnostics?.[0]?.code,
    undefined,
);
assert.match(
    serializeReportBuilderReportDocumentReadResponse(getResponse),
    /"semanticSummary": \{/,
);

const listResponse = buildReportBuilderListReportDocumentsResponse(savedReportPayload, {
    documentVersion: 11,
    cursor: "next-page",
    hasMore: true,
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
        },
        {
            documentVersion: 5,
            savedAt: 8950,
            savedReportPayload: capacityLocationSavedReportPayload,
        },
        {
            documentVersion: 6,
            savedAt: 8990,
            savedReportPayload: capacityTrendSavedReportPayload,
        },
        {
            documentVersion: 7,
            savedAt: 8995,
            savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
        },
        {
            documentVersion: 8,
            savedAt: 8998,
            savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
        },
    ],
    additionalEntries: [
        {
            reportRef: { reportId: "capacityArchive" },
            documentVersion: 9,
            title: "Capacity Archive",
        },
    ],
    savedAt: 9000,
});
const carriedSemanticListResponse = buildReportBuilderListReportDocumentsResponse(
    carriedSemanticSavedReportPayload,
    {
        documentVersion: 3,
        savedAt: 6200,
    },
);
assert.deepEqual(
    carriedSemanticListResponse.entries[0].semanticBindingViewState,
    carriedSemanticBindingViewState,
);
const carriedSemanticListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    carriedSemanticListResponse.entries[0],
);
assert.equal(carriedSemanticListEntrySummary.semanticBindingChips.includes("Model Carried Delivery"), true);
assert.deepEqual(
    carriedSemanticListEntrySummary.semanticBindingFieldGroups,
    carriedSemanticBindingViewState.fieldGroups,
);
assert.deepEqual(carriedSemanticListEntrySummary.shareableMetaChips, [
    "published",
    "v3",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Can View",
    "Can Export",
    "1 grant",
]);
const carriedSemanticSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    carriedSemanticListResponse,
    carriedSemanticSavedReportPayload,
    {
        request: {
            reportRef: { reportId: "carriedSemantic" },
        },
        savedAt: 6200,
    },
);
assert.deepEqual(
    carriedSemanticSelectedGetResponse.semanticBindingViewState,
    carriedSemanticBindingViewState,
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(carriedSemanticSelectedGetResponse).semanticBindingChips.includes("Model Carried Delivery"),
    true,
);
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(carriedSemanticSelectedGetResponse).shareableMetaChips, [
    "published",
    "v3",
    "Owner team://analytics",
    "policy://reports/certified",
    "Certified",
    "Can View",
    "Can Export",
    "1 grant",
]);
[
    {
        label: "empty",
        semanticBindingViewState: {},
    },
    {
        label: "title-only",
        semanticBindingViewState: {
            title: "Semantic Binding",
        },
    },
    {
        label: "anonymous-field-group",
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
    },
].forEach(({ label, semanticBindingViewState }) => {
    const malformedCarriedPayload = {
        ...savedReportPayload,
        semanticBindingViewState,
    };
    const malformedCarriedGetResponse = buildReportBuilderGetReportDocumentResponse(
        malformedCarriedPayload,
        {
            documentVersion: 11,
            savedAt: 6200,
        },
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(malformedCarriedGetResponse, "semanticBindingViewState"),
        false,
        `${label} carried state should not be persisted on get response`,
    );
    assert.equal(
        buildReportBuilderGetReportDocumentResponseSummary(malformedCarriedGetResponse).semanticBindingChips.includes("Model Ad Delivery"),
        true,
        `${label} carried state should fall back to get-response semantic metadata`,
    );

    const malformedCarriedListResponse = buildReportBuilderListReportDocumentsResponse(
        malformedCarriedPayload,
        {
            documentVersion: 11,
            savedAt: 6200,
        },
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(malformedCarriedListResponse.entries[0], "semanticBindingViewState"),
        false,
        `${label} carried state should not be persisted on list entry`,
    );
    assert.equal(
        buildReportBuilderListReportDocumentsEntrySummary(malformedCarriedListResponse.entries[0]).semanticBindingChips.includes("Model Ad Delivery"),
        true,
        `${label} carried state should fall back to list-entry semantic metadata`,
    );

    const malformedCarriedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
        malformedCarriedListResponse,
        malformedCarriedPayload,
        {
            request: {
                reportRef: { reportId: "demoReportBuilder" },
            },
            savedAt: 6200,
        },
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(malformedCarriedSelectedGetResponse, "semanticBindingViewState"),
        false,
        `${label} carried state should not be persisted on selected get response`,
    );
    assert.equal(
        buildReportBuilderGetReportDocumentResponseSummary(malformedCarriedSelectedGetResponse).semanticBindingChips.includes("Model Ad Delivery"),
        true,
        `${label} carried state should fall back to selected-get semantic metadata`,
    );
});

const sourceLessLocalListResponse = {
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
        },
    ],
};
const sourceLessLocalListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    sourceLessLocalListResponse.entries[0],
    {
        localSavedPayloads: [savedReportPayload],
    },
);
assert.equal(sourceLessLocalListEntrySummary.reopenable, true);
assert.equal(sourceLessLocalListEntrySummary.semanticBindingChips.includes("Model Ad Delivery"), true);
const sourceLessSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    sourceLessLocalListResponse,
    [savedReportPayload],
    {
        request: {
            reportRef: { reportId: "demoReportBuilder" },
        },
        savedAt: 6200,
    },
);
assert.notEqual(sourceLessSelectedGetResponse, null);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(sourceLessSelectedGetResponse).semanticBindingChips.includes("Model Ad Delivery"),
    true,
);

const directCarriedSavedRecord = {
    reportId: "directCarriedSemantic",
    title: "Direct Carried Semantic",
    documentVersion: 4,
    savedAt: 7300,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "directCarriedSemantic",
        title: "Direct Carried Semantic",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_direct_carried_semantic",
        sourceArtifactId: "direct_carried_semantic",
    },
    semanticBindingViewState: {
        title: "Semantic Binding",
        chips: [
            "Model Direct Carry Delivery",
            "Measures Direct Carry Impressions",
        ],
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "direct_carry_impressions",
                        label: "Direct Carry Impressions",
                        definitionRef: "harmonizer://feature/direct.carry.impressions",
                    },
                ],
            },
        ],
    },
};
const directCarriedListResponse = buildReportBuilderListReportDocumentsResponseFromSavedRecords([
    directCarriedSavedRecord,
]);
assert.deepEqual(
    directCarriedListResponse.entries[0].semanticBindingViewState,
    directCarriedSavedRecord.semanticBindingViewState,
);
const directCarriedListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    directCarriedListResponse.entries[0],
    {
        localSavedPayloads: [directCarriedSavedRecord],
    },
);
assert.equal(directCarriedListEntrySummary.semanticBindingChips.includes("Measures Direct Carry Impressions"), true);
assert.equal(
    directCarriedListEntrySummary.semanticBindingFieldGroups[0].fields[0].definitionRef,
    "harmonizer://feature/direct.carry.impressions",
);
const directCarriedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    directCarriedListResponse,
    [directCarriedSavedRecord],
    {
        request: {
            reportRef: { reportId: "directCarriedSemantic" },
        },
        savedAt: 7300,
    },
);
assert.deepEqual(
    directCarriedSelectedGetResponse.semanticBindingViewState,
    directCarriedSavedRecord.semanticBindingViewState,
);
const sourceLessDirectCarriedListResponse = {
    entries: [
        {
            reportRef: { reportId: "directCarriedSemantic" },
            documentVersion: 4,
            title: "Direct Carried Semantic",
        },
    ],
};
const sourceLessDirectCarriedListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(
    sourceLessDirectCarriedListResponse.entries[0],
    {
        localSavedPayloads: [directCarriedSavedRecord],
    },
);
assert.equal(sourceLessDirectCarriedListEntrySummary.reopenable, true);
assert.equal(sourceLessDirectCarriedListEntrySummary.semanticBindingChips.includes("Measures Direct Carry Impressions"), true);
const sourceLessDirectCarriedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    sourceLessDirectCarriedListResponse,
    [directCarriedSavedRecord],
    {
        request: {
            reportRef: { reportId: "directCarriedSemantic" },
        },
        savedAt: 7300,
    },
);
assert.deepEqual(
    sourceLessDirectCarriedSelectedGetResponse.semanticBindingViewState,
    directCarriedSavedRecord.semanticBindingViewState,
);

const ambiguousSourceLessCatalogBackings = [
    {
        reportId: "capacityShared",
        title: "Capacity Shared Saved View",
        documentVersion: 8,
        savedAt: 9300,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityShared",
            title: "Capacity Shared Saved View",
        },
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacityShared",
            sourceArtifactId: "saved_view_capacity_shared",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "savedView",
                artifactKind: "reportBuilder.savedView",
                artifactRef: "reportBuilder.savedView://saved_view_capacity_shared",
                sourceArtifactId: "saved_view_capacity_shared",
                reportId: "capacityShared",
                documentVersion: 8,
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Shared Saved View" },
        },
    },
    {
        reportId: "capacityShared",
        title: "Capacity Shared Published Snapshot",
        documentVersion: 9,
        savedAt: 9400,
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
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityShared",
            sourceArtifactId: "published_snapshot_capacity_shared",
        },
        exportRequest: {
            version: 1,
            kind: "reportExportRequest",
            target: { format: "pdf" },
            source: {
                from: "publishedSnapshot",
                artifactKind: "reportBuilder.publishedSnapshot",
                artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_shared",
                sourceArtifactId: "published_snapshot_capacity_shared",
                reportId: "capacityShared",
                documentVersion: 9,
            },
            reportSpec: {
                version: 1,
                kind: "reportSpec",
                blocks: [{ id: "primaryTable" }],
                datasets: [{ id: "primary" }],
            },
            reportFill: { version: 1, kind: "reportFill" },
            reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Shared Published Snapshot" },
        },
    },
];
const ambiguousSourceLessListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityShared" },
    documentVersion: 9,
    title: "Capacity Shared",
}, {
    localSavedPayloads: ambiguousSourceLessCatalogBackings,
});
assert.equal(ambiguousSourceLessListEntrySummary?.localBackingAvailability, "ambiguous");
assert.equal(ambiguousSourceLessListEntrySummary?.localBackingLabel, "ambiguous local backing");
assert.equal(ambiguousSourceLessListEntrySummary?.reopenable, undefined);
assert.equal(ambiguousSourceLessListEntrySummary?.exportable, undefined);
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityShared" },
            documentVersion: 9,
            title: "Capacity Shared",
        },
    ],
    cursor: "",
    hasMore: false,
}, ambiguousSourceLessCatalogBackings, {
    request: {
        reportRef: { reportId: "capacityShared" },
    },
}), null);
assert.deepEqual(buildReportBuilderListReportDocumentsEntryNotice(ambiguousSourceLessListEntrySummary), {
    tone: "warning",
    message: "This imported catalog entry matches multiple local reopen artifacts for the same report id. It can still prepare a get request and reopen diagnostic, but local reopen and export stay disabled until explicit source identity is available.",
});

const mismatchedLocalSemanticListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "carriedSemantic" },
    documentVersion: 3,
    title: "Carried Semantic",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_other_carried_semantic",
        sourceArtifactId: "other_carried_semantic",
    },
}, {
    localSavedPayloads: [carriedSemanticSavedReportPayload],
});
assert.equal(mismatchedLocalSemanticListEntrySummary.reopenable, undefined);
assert.equal(mismatchedLocalSemanticListEntrySummary.semanticBindingTitle, undefined);

const sharedArtifactListResponse = buildReportBuilderListReportDocumentsResponse(null, {
    localSavedPayloads: [
        {
            artifactId: "shared_view_capacity_shared",
            lifecycle: "draft",
            reportId: "capacityShared",
            title: "Capacity Shared Saved View",
            documentVersion: 8,
            savedAt: 9100,
            importedArtifactKind: "reportBuilder.savedView",
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
        {
            artifactId: "shared_snapshot_capacity_shared",
            lifecycle: "published",
            reportId: "capacityShared",
            title: "Capacity Shared Published Snapshot",
            documentVersion: 9,
            savedAt: 9200,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityShared",
                title: "Capacity Shared Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityShared",
                sourceArtifactId: "published_snapshot_capacity_shared",
            },
        },
    ],
    savedAt: 9200,
});
assert.equal(sharedArtifactListResponse.entries.length, 2);
assert.equal(sharedArtifactListResponse.entries[0].artifactId, "shared_view_capacity_shared");
assert.equal(sharedArtifactListResponse.entries[0].source.kind, "reportBuilder.savedView");
assert.equal(sharedArtifactListResponse.entries[1].source.kind, "reportBuilder.publishedSnapshot");

const sharedArtifactListInspector = buildReportBuilderReportDocumentReadResponseInspectorState(sharedArtifactListResponse, {
    selectedReportId: "capacityShared",
});
assert.equal(sharedArtifactListInspector?.artifactId, "shared_view_capacity_shared");
assert.equal(sharedArtifactListInspector?.sourceArtifactId, "saved_view_capacity_shared");
assert.equal(sharedArtifactListInspector?.lifecycle, "draft");
const sharedArtifactPublishedSelectionKey = buildReportBuilderListReportDocumentsEntrySelectionKey(
    sharedArtifactListResponse.entries[1],
);
const sharedArtifactPublishedInspector = buildReportBuilderReportDocumentReadResponseInspectorState(sharedArtifactListResponse, {
    selectedEntryKey: sharedArtifactPublishedSelectionKey,
    selectedReportId: "capacityShared",
});
assert.equal(sharedArtifactPublishedInspector?.artifactId, "shared_snapshot_capacity_shared");
assert.equal(sharedArtifactPublishedInspector?.sourceArtifactId, "published_snapshot_capacity_shared");
assert.equal(sharedArtifactPublishedInspector?.lifecycle, "published");
assert.match(
    buildReportBuilderReportDocumentReadResponseDownload(sharedArtifactListResponse, {
        selectedEntryKey: sharedArtifactPublishedSelectionKey,
        selectedReportId: "capacityShared",
    })?.payload || "",
    /"artifactId": "shared_snapshot_capacity_shared"/,
);

const sharedArtifactSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityShared" },
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
}, [
    {
        reportId: "capacityShared",
        title: "Capacity Shared Published Snapshot",
        documentVersion: 9,
        savedAt: 9200,
        importedArtifactKind: "reportBuilder.publishedSnapshot",
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityShared",
            title: "Capacity Shared Published Snapshot",
        },
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityShared",
            sourceArtifactId: "published_snapshot_capacity_shared",
        },
    },
    {
        reportId: "capacityShared",
        title: "Capacity Shared Saved View",
        documentVersion: 8,
        savedAt: 9100,
        importedArtifactKind: "reportBuilder.savedView",
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
], {
    request: {
        reportRef: { reportId: "capacityShared" },
    },
    savedAt: 9300,
});
assert.equal(sharedArtifactSelectedGetResponse.source.kind, "reportBuilder.savedView");
assert.equal(sharedArtifactSelectedGetResponse.document.title, "Capacity Shared Saved View");
const duplicateSharedArtifactSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    sharedArtifactListResponse,
    [
        {
            reportId: "capacityShared",
            title: "Capacity Shared Published Snapshot",
            documentVersion: 9,
            savedAt: 9200,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityShared",
                title: "Capacity Shared Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityShared",
                sourceArtifactId: "published_snapshot_capacity_shared",
            },
        },
        {
            reportId: "capacityShared",
            title: "Capacity Shared Saved View",
            documentVersion: 8,
            savedAt: 9100,
            importedArtifactKind: "reportBuilder.savedView",
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
    ],
    {
        request: {
            reportRef: { reportId: "capacityShared" },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityShared",
                sourceArtifactId: "published_snapshot_capacity_shared",
            },
            listEntrySelectionKey: sharedArtifactPublishedSelectionKey,
        },
        savedAt: 9200,
    },
);
assert.equal(duplicateSharedArtifactSelectedGetResponse?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(duplicateSharedArtifactSelectedGetResponse?.document?.title, "Capacity Shared Published Snapshot");

const sharedArtifactDirectSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromSharedArtifact({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityShared" },
            artifactId: "shared_view_capacity_shared",
            lifecycle: "draft",
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
}, [
    {
        artifactId: "shared_view_capacity_shared",
        artifactRef: "reportBuilder.savedView://shared_view_capacity_shared",
        shareableVersion: 4,
        lifecycle: "draft",
        ownerRef: "team://capacity",
        policyRef: "policy://capacity/shared",
        reportId: "capacityShared",
        title: "Capacity Shared Saved View",
        documentVersion: 8,
        savedAt: 9100,
        importedArtifactKind: "reportBuilder.savedView",
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
        reportSpec: {
            version: 1,
            kind: "reportSpec",
            blocks: [{ id: "primaryTable" }],
            datasets: [{ id: "primary" }],
        },
    },
], {
    request: {
        reportRef: { reportId: "capacityShared" },
    },
    savedAt: 9300,
});
assert.equal(sharedArtifactDirectSelectedGetResponse?.artifactId, "shared_view_capacity_shared");
assert.equal(sharedArtifactDirectSelectedGetResponse?.artifactRef, "reportBuilder.savedView://shared_view_capacity_shared");
assert.equal(sharedArtifactDirectSelectedGetResponse?.shareableVersion, 4);
assert.equal(sharedArtifactDirectSelectedGetResponse?.lifecycle, "draft");
assert.equal(sharedArtifactDirectSelectedGetResponse?.ownerRef, "team://capacity");
assert.equal(sharedArtifactDirectSelectedGetResponse?.policyRef, "policy://capacity/shared");
assert.equal(sharedArtifactDirectSelectedGetResponse?.reportSpec?.kind, "reportSpec");
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(sharedArtifactDirectSelectedGetResponse)?.artifactId,
    "shared_view_capacity_shared",
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(sharedArtifactDirectSelectedGetResponse)?.sourceArtifactId,
    "saved_view_capacity_shared",
);
assert.equal(
    buildReportBuilderGetReportDocumentResponseSummary(sharedArtifactDirectSelectedGetResponse)?.lifecycle,
    "draft",
);

const mergedSharedArtifactGetResponse = mergeReportBuilderGetReportDocumentResponseSharedArtifact({
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
}, {
    artifactId: "shared_view_capacity_shared",
    artifactKind: "reportBuilder.savedView",
    artifactRef: "reportBuilder.savedView://shared_view_capacity_shared",
    lifecycle: "published",
    ownerRef: "team://capacity",
    policyRef: "policy://capacity/shared",
    shareableVersion: 5,
    reportId: "capacityShared",
    documentVersion: 9,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityShared",
        sourceArtifactId: "published_snapshot_capacity_shared",
    },
});
assert.equal(mergedSharedArtifactGetResponse?.artifactId, "shared_view_capacity_shared");
assert.equal(mergedSharedArtifactGetResponse?.artifactRef, "reportBuilder.savedView://shared_view_capacity_shared");
assert.equal(mergedSharedArtifactGetResponse?.lifecycle, "published");
assert.equal(mergedSharedArtifactGetResponse?.ownerRef, "team://capacity");
assert.equal(mergedSharedArtifactGetResponse?.policyRef, "policy://capacity/shared");
assert.equal(mergedSharedArtifactGetResponse?.shareableVersion, 5);
assert.equal(mergedSharedArtifactGetResponse?.documentVersion, 9);
assert.equal(mergedSharedArtifactGetResponse?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(mergedSharedArtifactGetResponse?.source?.sourceArtifactId, "published_snapshot_capacity_shared");

assert.equal(listResponse.entries[0].subtitle, "Executive Snapshot");
assert.equal(listResponse.entries[0].description, "Saved authored report payload metadata.");
assert.deepEqual(listResponse, {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
            subtitle: "Executive Snapshot",
            description: "Saved authored report payload metadata.",
            savedAt: 9000,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
                sourceArtifactId: "rbexploration_rbexplore_1000_5000",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 1,
                datasetCount: 1,
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
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
                ],
            },
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
        },
        {
            reportRef: { reportId: "capacityQ3" },
            documentVersion: 4,
            title: "Capacity Q3",
            savedAt: 8900,
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_inventory_ladder",
                sourceArtifactId: "capacity_q3_inventory_ladder",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "capacityLocationQ3" },
            documentVersion: 5,
            title: "Capacity Location Q3",
            savedAt: 8950,
            templateId: "capacity_location_brief",
            templateLabel: "Capacity Location Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_location_ladder",
                sourceArtifactId: "capacity_q3_location_ladder",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "capacityTrendQ3" },
            documentVersion: 6,
            title: "Capacity Trend Q3",
            savedAt: 8990,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_trend",
                sourceArtifactId: "capacity_q3_trend",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "capacityInventoryTopChannelsQ3" },
            documentVersion: 7,
            title: "Capacity Inventory Top Channels Q3",
            savedAt: 8995,
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_inventory_top_channels",
                sourceArtifactId: "capacity_q3_inventory_top_channels",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "capacityLocationsTopMarketsQ3" },
            documentVersion: 8,
            title: "Capacity Locations Top Markets Q3",
            savedAt: 8998,
            templateId: "capacity_location_brief",
            templateLabel: "Capacity Location Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_locations_top_markets",
                sourceArtifactId: "capacity_q3_locations_top_markets",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "capacityArchive" },
            documentVersion: 9,
            title: "Capacity Archive",
        },
    ],
    cursor: "next-page",
    hasMore: true,
});

assert.deepEqual(buildReportBuilderListReportDocumentsResponseSummary(listResponse), {
    kind: "listReportDocumentsResponse",
    entryCount: 7,
    cursor: "next-page",
    hasMore: true,
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[0]), {
    reportId: "demoReportBuilder",
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    documentVersion: 11,
    compileStatus: "clean",
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1], {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
        },
    ],
}), {
    reportId: "capacityQ3",
    title: "Capacity Q3",
    documentVersion: 4,
    compileStatus: "clean",
    reopenable: true,
    backingState: "reopen-ready",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1]), {
    reportId: "capacityQ3",
    title: "Capacity Q3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1], {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedPayload",
                    artifactKind: "reportBuilder.savedReportPayload",
                    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3_inventory_ladder",
                    title: "Capacity Q3",
                    payloadId: "rbreport_capacity_q3_inventory_ladder",
                    sourceArtifactId: "capacity_q3_inventory_ladder",
                    reportId: "capacityQ3",
                    documentVersion: 4,
                },
                reportSpec: capacitySavedReportPayload.reportSpec,
                reportFill: { version: 1, kind: "reportFill" },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3" },
            },
            importedArtifactKind: "reportBuilder.savedReportRecord",
        },
    ],
}), {
    reportId: "capacityQ3",
    title: "Capacity Q3",
    documentVersion: 4,
    compileStatus: "clean",
    reopenable: true,
    backingState: "export-ready",
    backingSource: "imported report record",
    backingArtifactKindLabel: "report-file artifact",
    exportable: true,
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});

assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityQ3" },
    documentVersion: 12,
    title: "Capacity Q3",
    templateId: "market_brief",
    templateLabel: "Market Brief",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_inventory_ladder",
        sourceArtifactId: "capacity_q3_inventory_ladder",
    },
}, {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
        },
    ],
}), {
    reportId: "capacityQ3",
    title: "Capacity Q3",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
    templateId: "market_brief",
    templateLabel: "Market Brief",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1], {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedPayload",
                    artifactKind: "reportBuilder.savedReportPayload",
                    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3_inventory_ladder",
                    title: "Capacity Q3",
                    payloadId: "rbreport_capacity_q3_inventory_ladder",
                    sourceArtifactId: "capacity_q3_inventory_ladder",
                    reportId: "capacityQ3",
                    documentVersion: 4,
                },
                reportSpec: capacitySavedReportPayload.reportSpec,
                reportFill: { version: 1, kind: "reportFill" },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3" },
            },
            importedArtifactKind: "reportBuilder.savedReportRecord",
        },
    ],
}), {
    reportId: "capacityQ3",
    title: "Capacity Q3",
    documentVersion: 4,
    compileStatus: "clean",
    reopenable: true,
    backingState: "export-ready",
    backingSource: "imported report record",
    backingArtifactKindLabel: "report-file artifact",
    exportable: true,
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
assert.equal(buildReportBuilderListReportDocumentsEntryOptionLabel({
    reportId: "capacityQ3",
    title: "Capacity Q3",
    compileStatus: "clean",
    backingState: "export-ready",
    backingSource: "imported report record",
    backingArtifactKindLabel: "report-file artifact",
}), "Capacity Q3 • export-ready • imported report record • report-file artifact");
assert.equal(buildReportBuilderListReportDocumentsEntryOptionLabel({
    reportId: "capacityArchive",
    title: "Capacity Archive",
    compileStatus: "warning",
}), "Capacity Archive (warning)");
assert.equal(buildReportBuilderListReportDocumentsEntryOptionLabel(null), "");
assert.deepEqual(buildReportBuilderListReportDocumentsEntryMetaChips({
    templateLabel: "Capacity Inventory Brief",
    backingState: "export-ready",
    backingSource: "imported report record",
    backingArtifactKindLabel: "report-file artifact",
}), [
    "Capacity Inventory Brief",
    "export-ready",
    "imported report record",
    "report-file artifact",
]);
assert.deepEqual(buildReportBuilderListReportDocumentsEntryMetaChips({
    templateLabel: "Market Brief",
    templateConflictLabel: "template mismatch",
    backingState: "reopen-ready",
}), [
    "Market Brief",
    "template mismatch",
    "reopen-ready",
]);
assert.deepEqual(buildReportBuilderListReportDocumentsEntryMetaChips(null), []);
assert.deepEqual(buildReportBuilderListReportDocumentsEntryOptions(listResponse, {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedPayload",
                    artifactKind: "reportBuilder.savedReportPayload",
                    artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3_inventory_ladder",
                    title: "Capacity Q3",
                    payloadId: "rbreport_capacity_q3_inventory_ladder",
                    sourceArtifactId: "capacity_q3_inventory_ladder",
                    reportId: "capacityQ3",
                    documentVersion: 4,
                },
                reportSpec: capacitySavedReportPayload.reportSpec,
                reportFill: { version: 1, kind: "reportFill" },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3" },
            },
            importedArtifactKind: "reportBuilder.savedReportRecord",
        },
    ],
}), [
    {
        reportId: "demoReportBuilder",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[0]),
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
        compileStatus: "clean",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
    {
        reportId: "capacityQ3",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[1]),
        title: "Capacity Q3",
        subtitle: "",
        description: "",
        compileStatus: "clean",
        backingState: "export-ready",
        backingSource: "imported report record",
        backingArtifactKindLabel: "report-file artifact",
    },
    {
        reportId: "capacityLocationQ3",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[2]),
        title: "Capacity Location Q3",
        subtitle: "",
        description: "",
        compileStatus: "clean",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
    {
        reportId: "capacityTrendQ3",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[3]),
        title: "Capacity Trend Q3",
        subtitle: "",
        description: "",
        compileStatus: "clean",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
    {
        reportId: "capacityInventoryTopChannelsQ3",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[4]),
        title: "Capacity Inventory Top Channels Q3",
        subtitle: "",
        description: "",
        compileStatus: "clean",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
    {
        reportId: "capacityLocationsTopMarketsQ3",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[5]),
        title: "Capacity Locations Top Markets Q3",
        subtitle: "",
        description: "",
        compileStatus: "clean",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
    {
        reportId: "capacityArchive",
        selectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(listResponse.entries[6]),
        title: "Capacity Archive",
        subtitle: "",
        description: "",
        compileStatus: "",
        backingState: "",
        backingSource: "",
        backingArtifactKindLabel: "",
    },
]);
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(listResponse, {
    selectedReportId: "demoReportBuilder",
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 7,
    cursor: "next-page",
    hasMore: true,
    selectedEntry: {
        reportId: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
        documentVersion: 11,
        compileStatus: "clean",
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
                    { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for semantic preview.",
            },
        ],
    },
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(listResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(listResponse, {
    selectedReportId: "capacityQ3",
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: capacitySavedReportPayload,
        },
        {
            documentVersion: 5,
            savedAt: 8950,
            savedReportPayload: capacityLocationSavedReportPayload,
        },
    ],
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 7,
    cursor: "next-page",
    hasMore: true,
    selectedEntry: {
        reportId: "capacityQ3",
        title: "Capacity Q3",
        documentVersion: 4,
        compileStatus: "clean",
        reopenable: true,
        backingState: "reopen-ready",
        templateId: "capacity_inventory_brief",
        templateLabel: "Capacity Inventory Brief",
    },
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    content: serializeReportBuilderReportDocumentReadResponse(listResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(semanticSpecListResponse, {
    selectedReportId: "demoReportBuilder",
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 1,
    cursor: "",
    hasMore: false,
    selectedEntry: {
        reportId: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
        documentVersion: 11,
        compileStatus: "clean",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: [
            "Model Canonical Ad Delivery",
            "Entity Canonical Line Delivery",
            "Dimensions Canonical Delivery Date",
            "Measures Canonical Available Impressions",
        ],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
                ],
            },
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                ],
            },
        ],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for semantic preview.",
            },
        ],
    },
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Canonical Ad Delivery",
        "Entity Canonical Line Delivery",
        "Dimensions Canonical Delivery Date",
        "Measures Canonical Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(semanticSpecListResponse),
});

assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(semanticSpecListResponse, {
    selectedReportId: "demoReportBuilder",
    localSavedPayloads: [
        {
            documentVersion: 11,
            savedAt: 9002,
            savedReportPayload: semanticSpecSavedReportPayload,
        },
    ],
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 1,
    cursor: "",
    hasMore: false,
    selectedEntry: {
        reportId: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
        documentVersion: 11,
        compileStatus: "clean",
        reopenable: true,
        backingState: "reopen-ready",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: [
            "Model Canonical Ad Delivery",
            "Entity Canonical Line Delivery",
            "Dimensions Canonical Delivery Date",
            "Measures Canonical Available Impressions",
        ],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
                ],
            },
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
                ],
            },
        ],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for semantic preview.",
            },
        ],
    },
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Canonical Ad Delivery",
        "Entity Canonical Line Delivery",
        "Dimensions Canonical Delivery Date",
        "Measures Canonical Available Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for semantic preview.",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(semanticSpecListResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(directSemanticListResponse, {
    selectedReportId: "semanticCatalogEntry",
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 1,
    cursor: "",
    hasMore: false,
    selectedEntry: {
        reportId: "semanticCatalogEntry",
        title: "Semantic Catalog Entry",
        subtitle: "Direct list payload",
        description: "Semantic metadata is carried directly on the list entry.",
        documentVersion: 3,
        compileStatus: "",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: [
            "Model Direct Ad Delivery",
            "Entity Direct Line Delivery",
            "Dimensions Delivery Date",
            "Measures Available Impressions",
            "Parameters Reporting Window",
            "Categories Time, Metrics +1",
            "Owner team://example/performance",
        ],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    {
                        id: "event_date",
                        rawId: "eventDate",
                        label: "Delivery Date",
                        category: "Time",
                        governance: {
                            status: "approved",
                            certification: "reviewed",
                            ownerRef: "team://example/performance",
                        },
                    },
                ],
            },
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "available_impressions",
                        rawId: "avails",
                        label: "Available Impressions",
                        category: "Metrics",
                        governance: {
                            ownerRef: "team://example/performance",
                        },
                    },
                ],
            },
            {
                id: "parameters",
                title: "Selected parameters (1)",
                fields: [
                    {
                        id: "dateRange",
                        rawId: "dateRange",
                        label: "Reporting Window",
                        category: "Scope",
                        governance: {
                            ownerRef: "team://example/performance",
                        },
                    },
                ],
            },
        ],
        scopeSummaryTitle: "Report Scope",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Direct list entry scope.",
            },
        ],
    },
    headerSubtitle: "Direct list payload",
    headerDescription: "Semantic metadata is carried directly on the list entry.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Direct Ad Delivery",
        "Entity Direct Line Delivery",
        "Dimensions Delivery Date",
        "Measures Available Impressions",
        "Parameters Reporting Window",
        "Categories Time, Metrics +1",
        "Owner team://example/performance",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                {
                    id: "event_date",
                    rawId: "eventDate",
                    label: "Delivery Date",
                    category: "Time",
                    governance: {
                        status: "approved",
                        certification: "reviewed",
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "available_impressions",
                    rawId: "avails",
                    label: "Available Impressions",
                    category: "Metrics",
                    governance: {
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                {
                    id: "dateRange",
                    rawId: "dateRange",
                    label: "Reporting Window",
                    category: "Scope",
                    governance: {
                        ownerRef: "team://example/performance",
                    },
                },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Direct list entry scope.",
        },
    ],
    content: serializeReportBuilderReportDocumentReadResponse(directSemanticListResponse),
});

assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, savedReportPayload, {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
    savedAt: 9100,
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    savedAt: 9000,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Saved authored report payload metadata.",
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
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 1,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
        sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityQ3",
    },
    documentVersion: 4,
    savedAt: 8900,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityQ3",
        title: "Capacity Q3",
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
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_inventory_ladder",
        sourceArtifactId: "capacity_q3_inventory_ladder",
    },
});
const capacitySelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityQ3" },
    },
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(capacitySelectedGetResponse), {
    title: "Capacity Q3",
    kind: "getReportDocumentResponse",
    reportId: "capacityQ3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(capacitySelectedGetResponse), {
    title: "Capacity Q3",
    kind: "getReportDocumentResponse",
    reportId: "capacityQ3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    content: serializeReportBuilderReportDocumentReadResponse(capacitySelectedGetResponse),
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityLocationQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityLocationQ3",
    },
    documentVersion: 5,
    savedAt: 8950,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityLocationQ3",
        title: "Capacity Location Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_location_brief",
                    reportDocumentTemplateLabel: "Capacity Location Brief",
                },
            },
        ],
    },
    templateId: "capacity_location_brief",
    templateLabel: "Capacity Location Brief",
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_location_ladder",
        sourceArtifactId: "capacity_q3_location_ladder",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityTrendQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    documentVersion: 6,
    savedAt: 8990,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_trend",
        sourceArtifactId: "capacity_q3_trend",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityInventoryTopChannelsQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityInventoryTopChannelsQ3",
    },
    documentVersion: 7,
    savedAt: 8995,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityInventoryTopChannelsQ3",
        title: "Capacity Inventory Top Channels Q3",
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
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_inventory_top_channels",
        sourceArtifactId: "capacity_q3_inventory_top_channels",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityLocationsTopMarketsQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityLocationsTopMarketsQ3",
    },
    documentVersion: 8,
    savedAt: 8998,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityLocationsTopMarketsQ3",
        title: "Capacity Locations Top Markets Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "capacity_location_brief",
                    reportDocumentTemplateLabel: "Capacity Location Brief",
                },
            },
        ],
    },
    templateId: "capacity_location_brief",
    templateLabel: "Capacity Location Brief",
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_locations_top_markets",
        sourceArtifactId: "capacity_q3_locations_top_markets",
    },
});
const capacityLocationsTopMarketsSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityLocationsTopMarketsQ3" },
    },
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(capacityLocationsTopMarketsSelectedGetResponse), {
    title: "Capacity Locations Top Markets Q3",
    kind: "getReportDocumentResponse",
    reportId: "capacityLocationsTopMarketsQ3",
    documentVersion: 8,
    compileStatus: "clean",
    templateId: "capacity_location_brief",
    templateLabel: "Capacity Location Brief",
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(capacityLocationsTopMarketsSelectedGetResponse), {
    title: "Capacity Locations Top Markets Q3",
    kind: "getReportDocumentResponse",
    reportId: "capacityLocationsTopMarketsQ3",
    documentVersion: 8,
    compileStatus: "clean",
    templateId: "capacity_location_brief",
    templateLabel: "Capacity Location Brief",
    content: serializeReportBuilderReportDocumentReadResponse(capacityLocationsTopMarketsSelectedGetResponse),
});
const invalidCapacitySelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: {
            ...capacitySavedReportPayload,
            compileState: {
                status: "invalid",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
                diagnostics: [
                    {
                        code: "documentBlockValueFieldUnavailable",
                        severity: "error",
                        blockId: "headlineKpi",
                        path: "reportDocument.blocks.headlineKpi.valueField",
                        message: "Headline KPI references unavailable KPI value field 'avails'.",
                        suggestedFix: "Select the measure again or edit the KPI block.",
                    },
                ],
            },
        },
    },
], {
    request: {
        reportRef: { reportId: "capacityQ3" },
    },
});
assert.equal(invalidCapacitySelectedGetResponse.compileState.status, "invalid");
assert.equal(invalidCapacitySelectedGetResponse.compileState.diagnostics[0].code, "documentBlockValueFieldUnavailable");
assert.equal(invalidCapacitySelectedGetResponse.compileState.diagnostics[0].blockId, "headlineKpi");
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(invalidCapacitySelectedGetResponse), {
    title: "Capacity Q3",
    kind: "getReportDocumentResponse",
    reportId: "capacityQ3",
    documentVersion: 4,
    compileStatus: "invalid",
    templateId: "capacity_inventory_brief",
    templateLabel: "Capacity Inventory Brief",
});
const invalidDerivedListResponse = buildReportBuilderListReportDocumentsResponseFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_semantic_runtime_invalid",
    savedAt: 9301,
    title: "Semantic Runtime Invalid Demo",
    sourceArtifactId: "semantic_runtime_invalid_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "semanticRuntimeInvalidDemo",
        title: "Semantic Runtime Invalid Demo",
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
            defaultMode: "table",
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
        reportDocumentBlocks: [
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "missingMetric",
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "headlineKpi" },
            ],
        },
    },
    semanticModel: {
        modelRef: "model://example/performance/delivery@v1",
        version: 1,
        label: "Ad Delivery",
        entities: [
            {
                id: "line_delivery",
                label: "Line Delivery",
                dimensions: [
                    { id: "event_date", label: "Delivery Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
    documentVersion: 12,
    cursor: "next-page",
    hasMore: true,
});
const invalidDerivedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState(
    invalidDerivedListResponse,
    {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "semanticRuntimeInvalidDemo",
        },
        documentVersion: 12,
        savedAt: 9411,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "semanticRuntimeInvalidDemo",
            title: "Semantic Runtime Invalid Demo",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_semantic_runtime_invalid",
            sourceArtifactId: "semantic_runtime_invalid_demo",
        },
    },
    {
        request: {
            reportRef: {
                reportId: "semanticRuntimeInvalidDemo",
            },
        },
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
                defaultMode: "table",
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
            reportDocumentBlocks: [
                {
                    id: "headlineKpi",
                    kind: "kpiBlock",
                    title: "Headline KPI",
                    datasetRef: "primary",
                    valueField: "missingMetric",
                },
            ],
            reportDocumentLayout: {
                type: "stack",
                items: [
                    { blockId: "primaryBuilder" },
                    { blockId: "headlineKpi" },
                ],
            },
        },
        semanticModel: {
            modelRef: "model://example/performance/delivery@v1",
            version: 1,
            label: "Ad Delivery",
            entities: [
                {
                    id: "line_delivery",
                    label: "Line Delivery",
                    dimensions: [
                        { id: "event_date", label: "Delivery Date" },
                        { id: "channel", label: "Channel" },
                    ],
                    measures: [
                        { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                    ],
                },
            ],
        },
    },
);
assert.equal(invalidDerivedSelectedGetResponse.compileState.status, "invalid");
assert.equal(invalidDerivedSelectedGetResponse.compileState.diagnostics[0].code, "documentBlockValueFieldUnavailable");
const hydratedInvalidCapacitySelectedGetResponse = buildHydratedReportBuilderDocument(invalidDerivedSelectedGetResponse, {
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
assert.equal(hydratedInvalidCapacitySelectedGetResponse.valid, true);
const invalidCapacitySelectedGetSession = buildReportBuilderHydratedDocumentSession(hydratedInvalidCapacitySelectedGetResponse, {
    liveConfig: {
        result: {
            defaultMode: "table",
        },
    },
    liveState: {
        selectedDimensions: ["eventDate"],
        viewMode: "chart",
    },
});
assert.equal(invalidCapacitySelectedGetSession?.reopenedSemanticSummary?.modelLabel, "Ad Delivery");
assert.equal(invalidCapacitySelectedGetSession?.reopenedCompileState?.status, "invalid");
assert.equal(invalidCapacitySelectedGetSession?.reopenedCompileState?.diagnostics?.[0]?.code, "documentBlockValueFieldUnavailable");
assert.equal(invalidCapacitySelectedGetSession?.reopenedCompileState?.diagnostics?.[0]?.blockId, "headlineKpi");
const invalidMarketEfficiencyListResponse = {
    ...listResponse,
    entries: [
        ...listResponse.entries,
        {
            reportRef: { reportId: "marketEfficiencyBriefQ3" },
            documentVersion: 9,
            title: "Market Efficiency Brief Q3",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_market_efficiency_brief_q3",
                sourceArtifactId: "market_efficiency_brief_q3",
            },
            compileState: {
                status: "invalid",
            },
        },
    ],
};
const invalidMarketEfficiencySelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(invalidMarketEfficiencyListResponse, [
    savedReportPayload,
    {
        documentVersion: 9,
        savedAt: 980000,
        savedReportPayload: {
            ...capacityLocationsTopMarketsSavedReportPayload,
            reportDocument: {
                ...capacityLocationsTopMarketsSavedReportPayload.reportDocument,
                id: "marketEfficiencyBriefQ3",
                title: "Market Efficiency Brief Q3",
                blocks: [
                    {
                        id: "primaryBuilder",
                        kind: "reportBuilderBlock",
                        state: {
                            reportDocumentTemplateId: "market_efficiency_brief",
                            reportDocumentTemplateLabel: "Market Efficiency Brief",
                        },
                    },
                ],
            },
            sourceArtifactId: "market_efficiency_brief_q3",
            payloadId: "rbreport_market_efficiency_brief_q3",
            compileState: {
                status: "invalid",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
                diagnostics: [
                    {
                        code: "documentBlockColumnUnavailable",
                        severity: "error",
                        blockId: "reachRateTable",
                        path: "reportDocument.blocks.reachRateTable.columns[2]",
                        message: "Reach Rate Table references unavailable table column 'reachRate'.",
                        suggestedFix: "Re-select the field in the builder or edit the table block to use one of the current selected dimensions or measures.",
                    },
                ],
            },
        },
    },
], {
    request: {
        reportRef: { reportId: "marketEfficiencyBriefQ3" },
    },
});
assert.equal(invalidMarketEfficiencySelectedGetResponse.compileState.status, "invalid");
assert.equal(invalidMarketEfficiencySelectedGetResponse.compileState.diagnostics[0].code, "documentBlockColumnUnavailable");
assert.equal(invalidMarketEfficiencySelectedGetResponse.compileState.diagnostics[0].blockId, "reachRateTable");
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(invalidMarketEfficiencySelectedGetResponse), {
    title: "Market Efficiency Brief Q3",
    kind: "getReportDocumentResponse",
    reportId: "marketEfficiencyBriefQ3",
    documentVersion: 9,
    compileStatus: "invalid",
    templateId: "market_efficiency_brief",
    templateLabel: "Market Efficiency Brief",
});
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: capacitySavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: capacityLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: capacityTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: capacityInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: capacityLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "capacityArchive" },
    },
}), null);

const collidingListResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        listResponse.entries[0],
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 12,
            title: "Exploration Demo (Remote)",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "remote_payload",
                sourceArtifactId: "remote_artifact",
            },
        },
    ],
    cursor: "",
    hasMore: false,
};
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse(collidingListResponse, savedReportPayload, {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
}), null);

assert.equal(buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 5,
            title: "Exploration Demo (Remote)",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "remote_payload",
                sourceArtifactId: "remote_artifact",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, savedReportPayload, {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
}), null);

const selectedResponseWithoutEntrySavedAt = buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 14,
            title: "Exploration Demo",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
                sourceArtifactId: "rbexploration_rbexplore_1000_5000",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, savedReportPayload, {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
    savedAt: 9100,
});
assert.equal(selectedResponseWithoutEntrySavedAt?.documentVersion, 14);
assert.equal(selectedResponseWithoutEntrySavedAt?.savedAt, 9100);

const selectedResponseWithoutCompileState = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, {
    ...savedReportPayload,
    reportSpec: {},
}, {
    request: {
        reportRef: { reportId: "demoReportBuilder" },
    },
});
assert.equal(selectedResponseWithoutCompileState?.kind, "getReportDocumentResponse");
assert.equal(selectedResponseWithoutCompileState?.compileState, undefined);
const detailTargetSelectedSavedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_detail_target_selected_get",
    savedAt: 9990,
    title: "Detail Target Selected Get Demo",
    sourceArtifactId: "detail_target_selected_get_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "detailTargetSelectedGetDemo",
        title: "Detail Target Selected Get Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container: {
        id: "detailTargetSelectedGetBuilder",
        stateKey: "detailTargetSelectedGetBuilder",
        title: "Detail Target Selected Get Builder",
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
    savedAt: 10010,
});
const detailTargetSelectedListResponse = buildReportBuilderListReportDocumentsResponse(detailTargetSelectedSavedPayload, {
    documentVersion: 18,
    savedAt: 10020,
});
const detailTargetSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    detailTargetSelectedListResponse,
    [{
        documentVersion: 18,
        savedAt: 10020,
        savedReportPayload: detailTargetSelectedSavedPayload,
    }],
    {
        request: {
            reportRef: { reportId: "detailTargetSelectedGetDemo" },
        },
    },
);
assert.equal(detailTargetSelectedGetResponse.reportRef.reportId, "detailTargetSelectedGetDemo");
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(detailTargetSelectedGetResponse), {
    title: "Detail Target Selected Get Demo",
    kind: "getReportDocumentResponse",
    reportId: "detailTargetSelectedGetDemo",
    documentVersion: 18,
    compileStatus: "clean",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model model://example/performance/delivery@v1",
        "Entity line_delivery",
        "Dimensions Event Date, Channel",
        "Measures Avails",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Event Date", format: "date" },
                { id: "channel", rawId: "channelV2", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Avails", format: "compactNumber" },
            ],
        },
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "dateRange",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "dateRange",
        },
    ],
    drillHierarchyCount: 0,
    detailTargetCount: 1,
    drillSummaryText: "0 drill hierarchies • 0 levels • 1 detail target • 1 field action",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 0,
            savedAt: 9200,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported report file",
    backingArtifactKindLabel: "report-file artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 6,
            savedAt: 9200,
            importedArtifactKind: "getReportDocumentResponse",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported reopen bundle",
    backingArtifactKindLabel: "reopen-bundle artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 6,
            savedAt: 9200,
            importedArtifactKind: "createReportDocumentPayload",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported create request",
    backingArtifactKindLabel: "create-request artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 6,
            savedAt: 9200,
            importedArtifactKind: "updateReportDocumentPayload",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported update request",
    backingArtifactKindLabel: "update-request artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 6,
            savedAt: 9200,
            importedArtifactKind: "reportDocument",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported report document",
    backingArtifactKindLabel: "report-document artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 0,
            savedAt: 9200,
            importedArtifactKind: "reportBuilder.explorationArtifact",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported draft-snapshot",
    backingArtifactKindLabel: "draft-snapshot artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Saved View",
    source: {
        kind: "reportBuilder.savedView",
        reportId: "capacityTrendImported",
        sourceArtifactId: "saved_view_capacityTrendImported",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Saved View",
            documentVersion: 8,
            savedAt: 9201,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityTrendImported",
                sourceArtifactId: "saved_view_capacityTrendImported",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedView",
                    artifactKind: "reportBuilder.savedView",
                    artifactRef: "reportBuilder.savedView://saved_view_capacityTrendImported",
                    sourceArtifactId: "saved_view_capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 8,
                    title: "Capacity Trend Imported Saved View",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "export-ready",
    backingSource: "imported saved-view",
    backingArtifactKindLabel: "saved-view artifact",
    exportable: true,
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Saved View Overlay",
    source: {
        kind: "reportBuilder.savedView",
        reportId: "capacityTrendImported",
        sourceArtifactId: "saved_view_capacityTrendImported_overlay",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Saved View Overlay",
            documentVersion: 10,
            savedAt: 9201,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Saved View Overlay",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityTrendImported",
                sourceArtifactId: "saved_view_capacityTrendImported_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityTrendImported",
                    reportId: "capacityTrendImported",
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
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View Overlay",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported saved-view",
    backingArtifactKindLabel: "saved-view artifact",
    savedViewOverlayTitle: "Saved View Overlay",
    savedViewOverlayText: "1 filter • table view • Base v9",
    savedViewOverlayChips: [
        "1 filter",
        "table view",
        "Base v9",
    ],
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Published Snapshot",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityTrendImported",
        sourceArtifactId: "published_snapshot_capacityTrendImported",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Published Snapshot",
            documentVersion: 9,
            savedAt: 9202,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityTrendImported",
                sourceArtifactId: "published_snapshot_capacityTrendImported",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "publishedSnapshot",
                    artifactKind: "reportBuilder.publishedSnapshot",
                    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendImported",
                    sourceArtifactId: "published_snapshot_capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 9,
                    title: "Capacity Trend Imported Published Snapshot",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Published Snapshot",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "export-ready",
    backingSource: "imported published-snapshot",
    backingArtifactKindLabel: "published-snapshot artifact",
    exportable: true,
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Published Snapshot Overlay",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityTrendImported",
        sourceArtifactId: "published_snapshot_capacityTrendImported_overlay",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Published Snapshot Overlay",
            documentVersion: 11,
            savedAt: 9202,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Published Snapshot Overlay",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityTrendImported",
                sourceArtifactId: "published_snapshot_capacityTrendImported_overlay",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Published Snapshot Overlay",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported published-snapshot",
    backingArtifactKindLabel: "published-snapshot artifact",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Saved View Resolved Overlay",
    source: {
        kind: "reportBuilder.savedView",
        reportId: "capacityTrendImported",
        sourceArtifactId: "saved_view_capacityTrendImported_resolved_overlay",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Saved View Resolved Overlay",
            documentVersion: 10,
            savedAt: 9201,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Saved View Resolved Overlay",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityTrendImported",
                sourceArtifactId: "saved_view_capacityTrendImported_resolved_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 9,
                },
                publishedSnapshotRef: {
                    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendImported_resolved_overlay",
                    reportId: "capacityTrendImported",
                    documentVersion: 11,
                    sourceArtifactId: "published_snapshot_capacityTrendImported_resolved_overlay",
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
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Base",
            documentVersion: 9,
            savedAt: 9202,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Base",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_trend_imported_base",
                reportId: "capacityTrendImported",
            },
        },
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Snapshot",
            documentVersion: 11,
            savedAt: 9203,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacityTrendImported_resolved_overlay",
                reportId: "capacityTrendImported",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View Resolved Overlay",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported saved-view",
    backingArtifactKindLabel: "saved-view artifact",
    savedViewOverlayTitle: "Saved View Overlay",
    savedViewOverlayText: "1 filter • table view • Base v9 • Snapshot v11",
    savedViewOverlayChips: [
        "1 filter",
        "table view",
        "Base v9",
        "Snapshot v11",
    ],
    reopenSourceResolutionTitle: "Resolved Reopen Sources",
    reopenSourceResolutionText: "Resolved reopen against the published snapshot and base report file.",
    reopenSourceResolutionChips: [
        "Published snapshot published_snapshot_capacityTrendImported_resolved_overlay • capacityTrendImported",
        "Base report file capacity_trend_imported_base • capacityTrendImported",
    ],
    reopenSourceResolutionSources: [
        {
            id: "publishedSnapshot",
            label: "Published snapshot",
            value: "published_snapshot_capacityTrendImported_resolved_overlay • capacityTrendImported",
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacityTrendImported_resolved_overlay",
                reportId: "capacityTrendImported",
            },
        },
        {
            id: "baseReport",
            label: "Base report file",
            value: "capacity_trend_imported_base • capacityTrendImported",
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_trend_imported_base",
                reportId: "capacityTrendImported",
            },
        },
    ],
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Saved View Resolved Overlay",
}, {
    localSavedPayloads: [
        {
            artifactId: "saved_view_capacityTrendImported_resolved_overlay_artifact",
            lifecycle: "draft",
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Saved View Resolved Overlay",
            documentVersion: 10,
            savedAt: 9201,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Saved View Resolved Overlay",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityTrendImported",
                sourceArtifactId: "saved_view_capacityTrendImported_resolved_overlay",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 9,
                },
                publishedSnapshotRef: {
                    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendImported_resolved_overlay",
                    reportId: "capacityTrendImported",
                    documentVersion: 11,
                    sourceArtifactId: "published_snapshot_capacityTrendImported_resolved_overlay",
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
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Base",
            documentVersion: 9,
            savedAt: 9202,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Base",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                sourceArtifactId: "capacity_trend_imported_base",
                reportId: "capacityTrendImported",
            },
        },
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Snapshot",
            documentVersion: 11,
            savedAt: 9203,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacityTrendImported_resolved_overlay",
                reportId: "capacityTrendImported",
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View Resolved Overlay",
    documentVersion: 12,
    compileStatus: "",
    localBackingAvailability: "ambiguous",
    localBackingLabel: "ambiguous local backing",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntryNotice({
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View Overlay",
    reopenable: true,
    backingState: "reopen-ready",
    backingSource: "imported saved-view",
    backingArtifactKindLabel: "saved-view artifact",
}), {
    tone: "info",
    message: "This imported catalog entry is backed by a local reopen artifact, but no local export-ready artifact is available yet.",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntryNotice({
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported",
    reopenable: true,
    templateConflict: true,
    templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
}), {
    tone: "warning",
    message: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
});
assert.equal(buildReportBuilderListReportDocumentsEntryNotice({
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Saved View",
    reopenable: true,
    exportable: true,
    backingState: "export-ready",
}), null);
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported Published Snapshot",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityTrendImported",
        sourceArtifactId: "published_snapshot_capacityTrendImported",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Saved View",
            documentVersion: 8,
            savedAt: 9201,
            importedArtifactKind: "reportBuilder.savedView",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityTrendImported",
                sourceArtifactId: "saved_view_capacityTrendImported",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedView",
                    artifactKind: "reportBuilder.savedView",
                    artifactRef: "reportBuilder.savedView://saved_view_capacityTrendImported",
                    sourceArtifactId: "saved_view_capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 8,
                    title: "Capacity Trend Imported Saved View",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            },
        },
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported Published Snapshot",
            documentVersion: 9,
            savedAt: 9202,
            importedArtifactKind: "reportBuilder.publishedSnapshot",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityTrendImported",
                sourceArtifactId: "published_snapshot_capacityTrendImported",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "publishedSnapshot",
                    artifactKind: "reportBuilder.publishedSnapshot",
                    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacityTrendImported",
                    sourceArtifactId: "published_snapshot_capacityTrendImported",
                    reportId: "capacityTrendImported",
                    documentVersion: 9,
                    title: "Capacity Trend Imported Published Snapshot",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
            },
        },
    ],
}), {
    reportId: "capacityTrendImported",
    title: "Capacity Trend Imported Published Snapshot",
    documentVersion: 12,
    compileStatus: "",
    reopenable: true,
    backingState: "export-ready",
    backingSource: "imported published-snapshot",
    backingArtifactKindLabel: "published-snapshot artifact",
    exportable: true,
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityTrendImported" },
            documentVersion: 12,
            title: "Capacity Trend Imported",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, [
    {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        documentVersion: 0,
        savedAt: 9200,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
], {
    request: {
        reportRef: { reportId: "capacityTrendImported" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendImported",
    },
    documentVersion: 12,
    savedAt: 9200,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendImported",
        title: "Capacity Trend Imported",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
});

const templatedImportedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityTrendImported" },
            documentVersion: 12,
            title: "Capacity Trend Imported",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, [
    {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        documentVersion: 0,
        savedAt: 9200,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
], {
    request: {
        reportRef: { reportId: "capacityTrendImported" },
    },
});
assert.deepEqual(templatedImportedSelectedGetResponse, {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "capacityTrendImported",
    },
    documentVersion: 12,
    savedAt: 9200,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendImported",
        title: "Capacity Trend Imported",
        templateId: "market_brief",
        templateLabel: "Market Brief",
    },
    templateId: "market_brief",
    templateLabel: "Market Brief",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
});

const conflictingTemplatedImportedSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityTrendImported" },
            documentVersion: 12,
            title: "Capacity Trend Imported",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, [
    {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        documentVersion: 0,
        savedAt: 9200,
        document: {
            version: 1,
            kind: "reportDocument",
            id: "capacityTrendImported",
            title: "Capacity Trend Imported",
            templateId: "capacity_inventory_brief",
            templateLabel: "Capacity Inventory Brief",
        },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
], {
    request: {
        reportRef: { reportId: "capacityTrendImported" },
    },
});
assert.equal(conflictingTemplatedImportedSelectedGetResponse.document.templateId, "market_brief");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.document.templateLabel, "Market Brief");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.templateId, "market_brief");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.templateLabel, "Market Brief");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.compileState.status, "clean");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.compileState.diagnostics[0].code, "selectedGetTemplateIdentityConflict");
assert.equal(conflictingTemplatedImportedSelectedGetResponse.compileState.diagnostics[0].severity, "warning");
assert.match(
    conflictingTemplatedImportedSelectedGetResponse.compileState.diagnostics[0].message,
    /does not match the local reopen artifact template Capacity Inventory Brief/i,
);

const conflictingTemplatedImportedListEntrySummary = buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityTrendImported" },
    documentVersion: 12,
    title: "Capacity Trend Imported",
    templateId: "market_brief",
    templateLabel: "Market Brief",
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_imported_capacity_trend",
        sourceArtifactId: "imported_capacity_trend",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 6,
            savedAt: 9200,
            importedArtifactKind: "getReportDocumentResponse",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
});
assert.equal(conflictingTemplatedImportedListEntrySummary.templateConflict, true);
assert.equal(conflictingTemplatedImportedListEntrySummary.templateConflictLabel, "template mismatch");
assert.match(
    conflictingTemplatedImportedListEntrySummary.templateConflictMessage,
    /Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief\./,
);

assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityTrendImported" },
            documentVersion: 12,
            title: "Capacity Trend Imported",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    cursor: "",
    hasMore: false,
}, {
    selectedReportId: "capacityTrendImported",
    localSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 0,
            savedAt: 9200,
            importedArtifactKind: "getReportDocumentResponse",
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
                templateId: "capacity_inventory_brief",
                templateLabel: "Capacity Inventory Brief",
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 1,
    cursor: "",
    hasMore: false,
    selectedEntry: {
        reportId: "capacityTrendImported",
        title: "Capacity Trend Imported",
        documentVersion: 12,
        compileStatus: "",
        reopenable: true,
        backingState: "reopen-ready",
        backingSource: "imported reopen bundle",
        backingArtifactKindLabel: "reopen-bundle artifact",
        templateConflict: true,
        templateConflictLabel: "template mismatch",
        templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
        templateId: "market_brief",
        templateLabel: "Market Brief",
    },
    templateId: "market_brief",
    templateLabel: "Market Brief",
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
    content: serializeReportBuilderReportDocumentReadResponse({
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [
            {
                reportRef: { reportId: "capacityTrendImported" },
                documentVersion: 12,
                title: "Capacity Trend Imported",
                templateId: "market_brief",
                templateLabel: "Market Brief",
                source: {
                    kind: "reportBuilder.savedReportPayload",
                    payloadId: "rbreport_imported_capacity_trend",
                    sourceArtifactId: "imported_capacity_trend",
                },
            },
        ],
        cursor: "",
        hasMore: false,
    }),
});
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, savedReportPayload, {
    request: null,
}), null);

assert.match(
    serializeReportBuilderReportDocumentReadResponse(getResponse),
    /"kind": "getReportDocumentResponse"/,
);
assert.match(
    serializeReportBuilderReportDocumentReadResponse(listResponse),
    /"kind": "listReportDocumentsResponse"/,
);

assert.deepEqual(buildReportBuilderReportDocumentReadResponseDownload(getResponse), {
    filename: "Exploration Demo-getReportDocumentResponse.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderReportDocumentReadResponse(getResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseDownload(listResponse), {
    filename: "demoReportBuilder-listReportDocumentsResponse.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderReportDocumentReadResponse(listResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseDownload(listResponse, {
    selectedReportId: "capacityQ3",
}), {
    filename: "Capacity Q3-listReportDocumentsResponse.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderReportDocumentReadResponse(listResponse),
});
assert.match(
    buildReportBuilderReportDocumentReadResponseDownload(sharedArtifactListResponse, {
        selectedReportId: "capacityShared",
    })?.payload || "",
    /"artifactId": "shared_view_capacity_shared"/,
);

assert.equal(buildReportBuilderGetReportDocumentResponse(savedReportPayload, { documentVersion: "" }), null);
assert.equal(buildReportBuilderListReportDocumentsResponse(savedReportPayload, { documentVersion: 0 }), null);
assert.equal(buildReportBuilderGetReportDocumentResponse({
    ...savedReportPayload,
    reportSpec: {},
}, { documentVersion: 11 })?.kind, "getReportDocumentResponse");
assert.equal(buildReportBuilderListReportDocumentsResponse({
    ...savedReportPayload,
    reportSpec: {
        version: 1.5,
        kind: "reportSpec",
        blocks: [],
        datasets: [],
    },
}, { documentVersion: 11 })?.entries?.[0]?.compileState?.reportSpecVersion, 1);
assert.equal(buildReportBuilderGetReportDocumentResponseSummary(null), null);
assert.equal(buildReportBuilderListReportDocumentsEntrySummary(null), null);
assert.equal(buildReportBuilderListReportDocumentsResponseSummary(null), null);
assert.equal(buildReportBuilderReportDocumentReadResponseInspectorState(null), null);
assert.equal(serializeReportBuilderReportDocumentReadResponse(null), "");
assert.equal(buildReportBuilderReportDocumentReadResponseDownload(null), null);

console.log("reportBuilderReportDocumentReadResponse ✓ derives get/list ReportDocument responses from saved builder payloads");
