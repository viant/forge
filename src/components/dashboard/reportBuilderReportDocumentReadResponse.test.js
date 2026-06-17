import assert from "node:assert/strict";

import {
    buildReportBuilderDocumentVersionState,
    buildReportBuilderGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponseFromBuilderState,
    buildReportBuilderSelectedGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseSummary,
    buildReportBuilderListReportDocumentsEntrySummary,
    buildReportBuilderListReportDocumentsResponse,
    buildReportBuilderListReportDocumentsResponseFromBuilderState,
    buildReportBuilderListReportDocumentsResponseSummary,
    buildReportBuilderReportDocumentReadResponseInspectorState,
    buildReportBuilderReportDocumentReadResponseDownload,
    resolveReportBuilderDocumentVersion,
    serializeReportBuilderReportDocumentReadResponse,
} from "./reportBuilderReportDocumentReadResponse.js";

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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const forecastingSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_inventory_ladder",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceSession: {
        sessionId: "rbexplore_forecastingQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_inventory_brief",
            templateLabel: "Forecast Inventory Brief",
            contextLabel: "Forecasting Q3 • Inventory Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
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

const forecastingLocationSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_location_ladder",
    sourceArtifactId: "forecasting_q3_location_ladder",
    sourceSession: {
        sessionId: "rbexplore_forecastingLocationQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_location_brief",
            templateLabel: "Forecast Location Brief",
            contextLabel: "Forecasting Location Q3 • Location Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingLocationQ3",
        title: "Forecasting Location Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_location_brief",
                    reportDocumentTemplateLabel: "Forecast Location Brief",
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

const forecastingTrendSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_trend",
    sourceArtifactId: "forecasting_q3_trend",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }, { id: "primaryChart" }, { id: "comparisonTable" }],
        datasets: [{ id: "primary" }],
    },
};

const forecastingInventoryTopChannelsSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_inventory_top_channels",
    sourceArtifactId: "forecasting_q3_inventory_top_channels",
    sourceSession: {
        sessionId: "rbexplore_forecastingInventoryTopChannelsQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_inventory_brief",
            templateLabel: "Forecast Inventory Brief",
            contextLabel: "Forecasting Inventory Top Channels Q3 • Inventory · Top Channels",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingInventoryTopChannelsQ3",
        title: "Forecasting Inventory Top Channels Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
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

const forecastingLocationsTopMarketsSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_forecasting_q3_locations_top_markets",
    sourceArtifactId: "forecasting_q3_locations_top_markets",
    sourceSession: {
        sessionId: "rbexplore_forecastingLocationsTopMarketsQ3",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_location_brief",
            templateLabel: "Forecast Location Brief",
            contextLabel: "Forecasting Locations Top Markets Q3 • Locations · Top Markets",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingLocationsTopMarketsQ3",
        title: "Forecasting Locations Top Markets Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_location_brief",
                    reportDocumentTemplateLabel: "Forecast Location Brief",
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
    payloadId: "rbreport_forecast_inventory_brief",
    sourceArtifactId: "forecasting_q3_inventory_ladder",
    sourceSession: {
        sessionId: "rbexplore_forecast_inventory_brief",
        sourceRef: {
            kind: "reportBuilder.reportTemplate",
            templateId: "forecast_inventory_brief",
            templateLabel: "Forecast Inventory Brief",
            contextLabel: "Forecast Inventory Brief • Inventory Ladder",
        },
    },
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "forecastInventoryBrief",
        title: "Forecast Inventory Brief",
        subtitle: "Q2 Channel Ladder",
        description: "Forecast-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
    modelRef: "model://steward/performance/ad_delivery@v1",
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

assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(semanticSpecListResponse, semanticSpecSavedReportPayload, {
    request: {
        reportRef: {
            reportId: "demoReportBuilder",
        },
    },
    savedAt: 9003,
})?.reportSpec?.semanticSummary, {
    kind: "semantic",
    modelRef: "model://steward/performance/ad_delivery@v1",
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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    savedAt: 9410,
    semanticModel: {
        modelRef: "model://steward/performance/ad_delivery@v1",
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
                modelRef: "model://steward/performance/ad_delivery@v1",
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
                modelRef: "model://steward/performance/ad_delivery@v1",
                entity: "line_delivery",
                selectedDimensions: ["event_date", "channel"],
                selectedMeasures: ["available_impressions"],
            },
        },
        semanticModel: {
            modelRef: "model://steward/performance/ad_delivery@v1",
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

assert.equal(derivedSelectedGetResponse.source.kind, "reportBuilder.savedReportPayload");
assert.equal(derivedSelectedGetResponse.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedSelectedGetResponse.reportSpec.semanticSummary.entityLabel, "Line Delivery");

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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["available_impressions"],
        },
    },
    savedAt: 9410,
    semanticModel: {
        modelRef: "model://steward/performance/ad_delivery@v1",
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

assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(getResponse), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved authored report payload metadata.",
    kind: "getReportDocumentResponse",
    reportId: "demoReportBuilder",
    documentVersion: 11,
    compileStatus: "clean",
});
const templatedGetResponse = buildReportBuilderGetReportDocumentResponse(templatedSavedReportPayload, {
    documentVersion: 11,
    savedAt: 9000,
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(templatedGetResponse), {
    title: "Forecast Inventory Brief",
    subtitle: "Q2 Channel Ladder",
    description: "Forecast-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    kind: "getReportDocumentResponse",
    reportId: "forecastInventoryBrief",
    documentVersion: 11,
    compileStatus: "clean",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
});
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
    content: serializeReportBuilderReportDocumentReadResponse(getResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(templatedGetResponse), {
    title: "Forecast Inventory Brief",
    subtitle: "Q2 Channel Ladder",
    description: "Forecast-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    headerSubtitle: "Q2 Channel Ladder",
    headerDescription: "Forecast-first authored report starter seeded for Channel -> Publisher -> Site Type drill flows.",
    kind: "getReportDocumentResponse",
    reportId: "forecastInventoryBrief",
    documentVersion: 11,
    compileStatus: "clean",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
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
            savedReportPayload: forecastingSavedReportPayload,
        },
        {
            documentVersion: 5,
            savedAt: 8950,
            savedReportPayload: forecastingLocationSavedReportPayload,
        },
        {
            documentVersion: 6,
            savedAt: 8990,
            savedReportPayload: forecastingTrendSavedReportPayload,
        },
        {
            documentVersion: 7,
            savedAt: 8995,
            savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
        },
        {
            documentVersion: 8,
            savedAt: 8998,
            savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
        },
    ],
    additionalEntries: [
        {
            reportRef: { reportId: "forecastingArchive" },
            documentVersion: 9,
            title: "Forecasting Archive",
        },
    ],
    savedAt: 9000,
});
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
        },
        {
            reportRef: { reportId: "forecastingQ3" },
            documentVersion: 4,
            title: "Forecasting Q3",
            savedAt: 8900,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_forecasting_q3_inventory_ladder",
                sourceArtifactId: "forecasting_q3_inventory_ladder",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "forecastingLocationQ3" },
            documentVersion: 5,
            title: "Forecasting Location Q3",
            savedAt: 8950,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_forecasting_q3_location_ladder",
                sourceArtifactId: "forecasting_q3_location_ladder",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 2,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "forecastingTrendQ3" },
            documentVersion: 6,
            title: "Forecasting Trend Q3",
            savedAt: 8990,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_forecasting_q3_trend",
                sourceArtifactId: "forecasting_q3_trend",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "forecastingInventoryTopChannelsQ3" },
            documentVersion: 7,
            title: "Forecasting Inventory Top Channels Q3",
            savedAt: 8995,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_forecasting_q3_inventory_top_channels",
                sourceArtifactId: "forecasting_q3_inventory_top_channels",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "forecastingLocationsTopMarketsQ3" },
            documentVersion: 8,
            title: "Forecasting Locations Top Markets Q3",
            savedAt: 8998,
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_forecasting_q3_locations_top_markets",
                sourceArtifactId: "forecasting_q3_locations_top_markets",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 3,
                datasetCount: 1,
            },
        },
        {
            reportRef: { reportId: "forecastingArchive" },
            documentVersion: 9,
            title: "Forecasting Archive",
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
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1], {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: forecastingSavedReportPayload,
        },
    ],
}), {
    reportId: "forecastingQ3",
    title: "Forecasting Q3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
});
assert.deepEqual(buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[1], {
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: forecastingSavedReportPayload,
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedPayload",
                    artifactKind: "reportBuilder.savedReportPayload",
                    artifactRef: "reportBuilder.savedReportPayload://rbreport_forecasting_q3_inventory_ladder",
                    title: "Forecasting Q3",
                    payloadId: "rbreport_forecasting_q3_inventory_ladder",
                    sourceArtifactId: "forecasting_q3_inventory_ladder",
                    reportId: "forecastingQ3",
                    documentVersion: 4,
                },
                reportSpec: forecastingSavedReportPayload.reportSpec,
                reportFill: { version: 1, kind: "reportFill" },
                reportPrint: { version: 1, kind: "reportPrint", title: "Forecasting Q3" },
            },
        },
    ],
}), {
    reportId: "forecastingQ3",
    title: "Forecasting Q3",
    documentVersion: 4,
    compileStatus: "clean",
    exportable: true,
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
});
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
    },
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved authored report payload metadata.",
    content: serializeReportBuilderReportDocumentReadResponse(listResponse),
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(listResponse, {
    selectedReportId: "forecastingQ3",
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: forecastingSavedReportPayload,
        },
        {
            documentVersion: 5,
            savedAt: 8950,
            savedReportPayload: forecastingLocationSavedReportPayload,
        },
    ],
}), {
    kind: "listReportDocumentsResponse",
    entryCount: 7,
    cursor: "next-page",
    hasMore: true,
    selectedEntry: {
        reportId: "forecastingQ3",
        title: "Forecasting Q3",
        documentVersion: 4,
        compileStatus: "clean",
        templateId: "forecast_inventory_brief",
        templateLabel: "Forecast Inventory Brief",
    },
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
    content: serializeReportBuilderReportDocumentReadResponse(listResponse),
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
            modelRef: "model://steward/performance/ad_delivery@v1",
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
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingQ3",
    },
    documentVersion: 4,
    savedAt: 8900,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingQ3",
        title: "Forecasting Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
                },
            },
        ],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_inventory_ladder",
        sourceArtifactId: "forecasting_q3_inventory_ladder",
    },
});
const forecastingSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingQ3" },
    },
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(forecastingSelectedGetResponse), {
    title: "Forecasting Q3",
    kind: "getReportDocumentResponse",
    reportId: "forecastingQ3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(forecastingSelectedGetResponse), {
    title: "Forecasting Q3",
    kind: "getReportDocumentResponse",
    reportId: "forecastingQ3",
    documentVersion: 4,
    compileStatus: "clean",
    templateId: "forecast_inventory_brief",
    templateLabel: "Forecast Inventory Brief",
    content: serializeReportBuilderReportDocumentReadResponse(forecastingSelectedGetResponse),
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingLocationQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingLocationQ3",
    },
    documentVersion: 5,
    savedAt: 8950,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingLocationQ3",
        title: "Forecasting Location Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_location_brief",
                    reportDocumentTemplateLabel: "Forecast Location Brief",
                },
            },
        ],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 2,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_location_ladder",
        sourceArtifactId: "forecasting_q3_location_ladder",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingTrendQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingTrendQ3",
    },
    documentVersion: 6,
    savedAt: 8990,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_trend",
        sourceArtifactId: "forecasting_q3_trend",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingInventoryTopChannelsQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingInventoryTopChannelsQ3",
    },
    documentVersion: 7,
    savedAt: 8995,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingInventoryTopChannelsQ3",
        title: "Forecasting Inventory Top Channels Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_inventory_brief",
                    reportDocumentTemplateLabel: "Forecast Inventory Brief",
                },
            },
        ],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_inventory_top_channels",
        sourceArtifactId: "forecasting_q3_inventory_top_channels",
    },
});
assert.deepEqual(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingLocationsTopMarketsQ3" },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingLocationsTopMarketsQ3",
    },
    documentVersion: 8,
    savedAt: 8998,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingLocationsTopMarketsQ3",
        title: "Forecasting Locations Top Markets Q3",
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                state: {
                    reportDocumentTemplateId: "forecast_location_brief",
                    reportDocumentTemplateLabel: "Forecast Location Brief",
                },
            },
        ],
    },
    compileState: {
        status: "clean",
        reportSpecVersion: 1,
        blockCount: 3,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_locations_top_markets",
        sourceArtifactId: "forecasting_q3_locations_top_markets",
    },
});
const forecastingLocationsTopMarketsSelectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingLocationsTopMarketsQ3" },
    },
});
assert.deepEqual(buildReportBuilderGetReportDocumentResponseSummary(forecastingLocationsTopMarketsSelectedGetResponse), {
    title: "Forecasting Locations Top Markets Q3",
    kind: "getReportDocumentResponse",
    reportId: "forecastingLocationsTopMarketsQ3",
    documentVersion: 8,
    compileStatus: "clean",
    templateId: "forecast_location_brief",
    templateLabel: "Forecast Location Brief",
});
assert.deepEqual(buildReportBuilderReportDocumentReadResponseInspectorState(forecastingLocationsTopMarketsSelectedGetResponse), {
    title: "Forecasting Locations Top Markets Q3",
    kind: "getReportDocumentResponse",
    reportId: "forecastingLocationsTopMarketsQ3",
    documentVersion: 8,
    compileStatus: "clean",
    templateId: "forecast_location_brief",
    templateLabel: "Forecast Location Brief",
    content: serializeReportBuilderReportDocumentReadResponse(forecastingLocationsTopMarketsSelectedGetResponse),
});
assert.equal(buildReportBuilderSelectedGetReportDocumentResponse(listResponse, [
    savedReportPayload,
    {
        documentVersion: 4,
        savedAt: 8900,
        savedReportPayload: forecastingSavedReportPayload,
    },
    {
        documentVersion: 5,
        savedAt: 8950,
        savedReportPayload: forecastingLocationSavedReportPayload,
    },
    {
        documentVersion: 6,
        savedAt: 8990,
        savedReportPayload: forecastingTrendSavedReportPayload,
    },
    {
        documentVersion: 7,
        savedAt: 8995,
        savedReportPayload: forecastingInventoryTopChannelsSavedReportPayload,
    },
    {
        documentVersion: 8,
        savedAt: 8998,
        savedReportPayload: forecastingLocationsTopMarketsSavedReportPayload,
    },
], {
    request: {
        reportRef: { reportId: "forecastingArchive" },
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
    selectedReportId: "forecastingQ3",
}), {
    filename: "Forecasting Q3-listReportDocumentsResponse.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderReportDocumentReadResponse(listResponse),
});

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
