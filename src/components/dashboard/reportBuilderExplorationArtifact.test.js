import assert from "node:assert/strict";

import {
    buildReportBuilderExplorationArtifactDownload,
    buildReportBuilderExplorationArtifact,
    buildReportBuilderExplorationArtifactInspectorState,
    buildReportBuilderExplorationArtifactSummary,
    serializeReportBuilderExplorationArtifact,
} from "./reportBuilderExplorationArtifact.js";
import {
    beginReportBuilderExplorationSession,
    buildReportBuilderExplorationSourceContextFromTableRow,
    recordReportBuilderExplorationHistory,
} from "./reportBuilderExplorationSession.js";

const container = {
    id: "demoReportBuilder",
    stateKey: "demoReportBuilder",
    title: "Exploration Demo",
    dataSourceRef: "demoReportSource",
};

const config = {
    title: "Exploration Demo",
    dataSourceRef: "demoReportSource",
    measures: [
        { id: "totalSpend", key: "totalSpend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
        { id: "impressions", key: "impressions", label: "Impressions", paramPath: "measures.impressions" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
        { id: "channelId", key: "channelId", label: "Channel", default: true, paramPath: "dimensions.channelId" },
    ],
    staticFilters: [
        {
            id: "dateRange",
            label: "Date Range",
            type: "dateRange",
            required: true,
            default: { start: "2026-05-01", end: "2026-05-04" },
            startParamPath: "filters.from",
            endParamPath: "filters.to",
        },
    ],
    result: {
        defaultMode: "table",
        viewModes: ["table", "chart"],
    },
};

const baseState = {
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    selectedDimensions: ["eventDate", "channelId"],
    viewMode: "table",
    scopeParams: {
        dateRange: {
            start: "2026-05-01",
            end: "2026-05-04",
        },
    },
};

const sessionState = beginReportBuilderExplorationSession(baseState, {
    container,
    sourceKind: "reportBuilder.tableRow",
    sourceContext: buildReportBuilderExplorationSourceContextFromTableRow({
        row: {
            eventDate: "2026-05-01",
            channelId: "Display",
        },
        rowIndex: 0,
        labelSelectors: ["eventDate", "channelId"],
    }),
    nowMs: 1000,
});

const mutatedState = recordReportBuilderExplorationHistory(sessionState, {
    ...sessionState,
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
}, {
    nowMs: 2000,
});

const artifact = buildReportBuilderExplorationArtifact({
    container,
    config,
    state: mutatedState,
    savedAt: 5000,
});

assert.equal(artifact.kind, "reportBuilder.explorationArtifact");
assert.equal(artifact.artifactId, "rbexploration_rbexplore_1000_5000");
assert.equal(artifact.title, "Exploration Demo");
artifact.document.subtitle = "Executive Snapshot";
artifact.document.description = "Saved exploration artifact metadata.";
assert.equal(artifact.sourceSession.sessionId, "rbexplore_1000");
assert.equal(artifact.sourceSession.sourceRef.kind, "reportBuilder.tableRow");
assert.equal(artifact.sourceSession.sourceRef.contextLabel, "2026-05-01 • Display");
assert.equal(artifact.document.kind, "reportDocument");
assert.equal(artifact.document.blocks[0].kind, "reportBuilderBlock");
assert.equal(artifact.document.blocks[0].state.explorationSession, undefined);
assert.deepEqual(artifact.document.blocks[0].state.selectedMeasures, ["totalSpend", "impressions"]);
assert.equal(artifact.reportSpec.kind, "reportSpec");
assert.deepEqual(artifact.reportSpec.blocks.map((block) => block.id), ["primaryTable"]);

assert.deepEqual(buildReportBuilderExplorationArtifactSummary(artifact), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved exploration artifact metadata.",
    artifactId: "rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Date Range",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
    ],
});

assert.match(
    serializeReportBuilderExplorationArtifact(artifact),
    /"kind": "reportBuilder\.explorationArtifact"/,
);
assert.match(
    serializeReportBuilderExplorationArtifact(artifact),
    /"artifactId": "rbexploration_rbexplore_1000_5000"/,
);

assert.deepEqual(buildReportBuilderExplorationArtifactInspectorState(artifact), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Saved exploration artifact metadata.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Saved exploration artifact metadata.",
    artifactId: "rbexploration_rbexplore_1000_5000",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Date Range",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
    ],
    payload: serializeReportBuilderExplorationArtifact(artifact),
});

assert.deepEqual(buildReportBuilderExplorationArtifactDownload(artifact), {
    filename: "Exploration Demo-exploration-artifact.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderExplorationArtifact(artifact),
});

assert.equal(buildReportBuilderExplorationArtifact({ container, config, state: baseState }), null);
assert.equal(serializeReportBuilderExplorationArtifact(null), "");
assert.equal(buildReportBuilderExplorationArtifactInspectorState(null), null);
assert.equal(buildReportBuilderExplorationArtifactDownload(null), null);

const semanticArtifact = buildReportBuilderExplorationArtifact({
    container,
    config: {
        ...config,
        measures: [
            { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
            { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", paramPath: "measures.impressions" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
            { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", default: true, paramPath: "dimensions.channelId" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend", "impressions"],
        },
    },
    state: {
        ...mutatedState,
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend", "impressions"],
        },
    },
    savedAt: 5100,
    semanticModel: {
        modelRef: "model://example/performance/delivery@v1",
        version: 1,
        label: "Ad Delivery",
        entities: [
            {
                id: "line_delivery",
                label: "Line Delivery",
                dimensions: [
                    { id: "event_date", label: "Event Date" },
                    { id: "channel", label: "Channel" },
                ],
                measures: [
                    { id: "total_spend", label: "Total Spend", format: "currency" },
                    { id: "impressions", label: "Impressions", format: "compactNumber" },
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
});

assert.equal(semanticArtifact.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(semanticArtifact.reportSpec.semanticSummary.entityLabel, "Line Delivery");
assert.equal(semanticArtifact.document.blocks[0].config.measures[0].label, "Total Spend");
assert.equal(semanticArtifact.document.blocks[0].config.dimensions[0].label, "Event Date");
assert.equal(semanticArtifact.compileState.status, "clean");
assert.equal(semanticArtifact.compileState.diagnostics[0].code, "semanticProviderDiagnostics");
assert.equal(semanticArtifact.semanticBindingViewState.title, "Semantic Binding");
assert.equal(semanticArtifact.semanticBindingViewState.chips.includes("Model Ad Delivery"), true);
assert.deepEqual(buildReportBuilderExplorationArtifactSummary(semanticArtifact), {
    title: "Exploration Demo",
    artifactId: "rbexploration_rbexplore_1000_5100",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Date Range",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Event Date, Channel",
        "Measures Total Spend, Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Event Date" },
                { id: "channel", rawId: "channelId", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (2)",
            fields: [
                { id: "total_spend", rawId: "totalSpend", label: "Total Spend", format: "currency" },
                { id: "impressions", rawId: "impressions", label: "Impressions", format: "compactNumber" },
            ],
        },
    ],
});
assert.deepEqual(buildReportBuilderExplorationArtifactInspectorState(semanticArtifact), {
    title: "Exploration Demo",
    artifactId: "rbexploration_rbexplore_1000_5100",
    kind: "reportBuilder.explorationArtifact",
    sourceKind: "reportBuilder.tableRow",
    sourceLabel: "2026-05-01 • Display",
    blockCount: 1,
    datasetCount: 1,
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Date Range",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Date Range",
        },
    ],
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Event Date, Channel",
        "Measures Total Spend, Impressions",
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Event Date" },
                { id: "channel", rawId: "channelId", label: "Channel" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (2)",
            fields: [
                { id: "total_spend", rawId: "totalSpend", label: "Total Spend", format: "currency" },
                { id: "impressions", rawId: "impressions", label: "Impressions", format: "compactNumber" },
            ],
        },
    ],
    payload: serializeReportBuilderExplorationArtifact(semanticArtifact),
});

const loadingFallbackSemanticArtifact = buildReportBuilderExplorationArtifact({
    container,
    config: {
        ...config,
        measures: [
            { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
            { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", default: true, paramPath: "dimensions.channelId" },
        ],
        staticFilters: [
            { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window", startParamPath: "filters.from", endParamPath: "filters.to" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend"],
        },
    },
    state: {
        ...mutatedState,
        selectedMeasures: ["totalSpend"],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend"],
        },
    },
    savedAt: 5200,
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
            { id: "channel", rawId: "channelId", label: "Fallback Channel" },
        ],
        selectedMeasures: [
            { id: "total_spend", rawId: "totalSpend", label: "Fallback Total Spend", format: "currency" },
        ],
    },
    fallbackSemanticFingerprint: JSON.stringify({
        modelRef: "model://example/performance/delivery@v1",
        selection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["total_spend"],
            parameters: {
                reporting_window: {
                    start: "2026-05-01",
                    end: "2026-05-04",
                },
            },
        },
    }),
});

assert.equal(loadingFallbackSemanticArtifact.reportSpec.semanticSummary.modelLabel, "Fallback Ad Delivery");
assert.equal(loadingFallbackSemanticArtifact.reportSpec.semanticSummary.entityLabel, "Fallback Line Delivery");
assert.equal(loadingFallbackSemanticArtifact.reportSpec.semanticSummary.selectedDimensions[0].label, "Fallback Event Date");
assert.equal(loadingFallbackSemanticArtifact.semanticBindingViewState.chips.includes("Model Fallback Ad Delivery"), true);
assert.equal(loadingFallbackSemanticArtifact.semanticBindingViewState.chips.includes("Dimensions Fallback Event Date, Fallback Channel"), true);

const unavailableFallbackSemanticArtifact = buildReportBuilderExplorationArtifact({
    container,
    config: {
        ...config,
        measures: [
            { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Spend", default: true, paramPath: "measures.totalSpend" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", default: true, chartAxis: true, paramPath: "dimensions.eventDate" },
            { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", default: true, paramPath: "dimensions.channelId" },
        ],
        staticFilters: [
            { id: "dateRange", type: "dateRange", label: "Date Range", semanticRef: "reporting_window", startParamPath: "filters.from", endParamPath: "filters.to" },
        ],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend"],
        },
    },
    state: {
        ...mutatedState,
        selectedMeasures: ["totalSpend"],
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["total_spend"],
        },
    },
    savedAt: 5201,
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
            { id: "channel", rawId: "channelId", label: "Fallback Channel" },
        ],
        selectedMeasures: [
            { id: "total_spend", rawId: "totalSpend", label: "Fallback Total Spend", format: "currency" },
        ],
    },
    fallbackSemanticFingerprint: JSON.stringify({
        modelRef: "model://example/performance/delivery@v1",
        selection: {
            entity: "line_delivery",
            dimensions: ["event_date", "channel"],
            measures: ["total_spend"],
            parameters: {
                reporting_window: {
                    start: "2026-05-01",
                    end: "2026-05-04",
                },
            },
        },
    }),
});

assert.equal(unavailableFallbackSemanticArtifact.reportSpec.semanticSummary.modelLabel || "", "");
assert.equal(unavailableFallbackSemanticArtifact.reportSpec.semanticSummary.entityLabel || "", "");
assert.equal(unavailableFallbackSemanticArtifact.reportSpec.semanticSummary.selectedDimensions[0].label, "Event Date");
assert.equal(unavailableFallbackSemanticArtifact.semanticBindingViewState.chips.includes("Model Fallback Ad Delivery"), false);
assert.equal(unavailableFallbackSemanticArtifact.semanticBindingViewState.chips.includes("Dimensions Event Date, Channel"), true);

const embeddedSemanticArtifactSummary = buildReportBuilderExplorationArtifactSummary({
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_embedded_5100",
    title: "Embedded Exploration Demo",
    sourceSession: {
        sessionId: "rbexplore_embedded_5100",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedExplorationDemo",
        title: "Embedded Exploration Demo",
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
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", category: "Time" },
                        { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Total Spend", category: "Metrics", format: "currency" },
                        { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", category: "Metrics", format: "compactNumber" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Date Range",
                            description: "Embedded exploration scope.",
                            required: true,
                        },
                    ],
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["total_spend"],
                    },
                },
                state: {
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["total_spend", "impressions"],
                    },
                    selectedDimensions: ["eventDate", "channelId"],
                    selectedMeasures: ["totalSpend", "impressions"],
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
});
assert.equal(embeddedSemanticArtifactSummary.semanticBindingChips.includes("Dimensions Event Date, Channel"), true);
assert.equal(embeddedSemanticArtifactSummary.scopeSummaryText, "Date Range");

const carriedSemanticExplorationArtifactSummary = buildReportBuilderExplorationArtifactSummary({
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_carried_semantic_5102",
    title: "Carried Semantic Exploration",
    sourceSession: {
        sessionId: "rbexplore_carried_5102",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    semanticBindingViewState: {
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
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "carriedSemanticExploration",
        title: "Carried Semantic Exploration",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
});
assert.deepEqual(carriedSemanticExplorationArtifactSummary.semanticBindingChips, [
    "Model Carried Delivery",
    "Measures Carried Spend",
]);
assert.deepEqual(carriedSemanticExplorationArtifactSummary.semanticBindingFieldGroups, [
    {
        id: "measures",
        title: "Selected measures (1)",
        fields: [
            { id: "spend", label: "Carried Spend", format: "currency" },
        ],
    },
]);

const titleOnlyCarriedSemanticExplorationArtifactSummary = buildReportBuilderExplorationArtifactSummary({
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_title_only_carried_5103",
    title: "Title Only Carried Semantic Exploration",
    semanticBindingViewState: {
        title: "Semantic Binding",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "titleOnlyCarriedSemanticExploration",
        title: "Title Only Carried Semantic Exploration",
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
assert.equal(titleOnlyCarriedSemanticExplorationArtifactSummary.semanticBindingChips.includes("Model Revenue Operations"), true);
assert.equal(titleOnlyCarriedSemanticExplorationArtifactSummary.semanticBindingChips.includes("Measures Net Revenue"), true);

const malformedFieldGroupCarriedSemanticExplorationArtifactSummary = buildReportBuilderExplorationArtifactSummary({
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_malformed_field_group_5104",
    title: "Malformed Carried Semantic Exploration",
    semanticBindingViewState: {
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [{}],
            },
        ],
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "malformedCarriedSemanticExploration",
        title: "Malformed Carried Semantic Exploration",
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
assert.equal(malformedFieldGroupCarriedSemanticExplorationArtifactSummary.semanticBindingChips.includes("Model Revenue Operations"), true);
assert.equal(malformedFieldGroupCarriedSemanticExplorationArtifactSummary.semanticBindingChips.includes("Measures Net Revenue"), true);

const embeddedSemanticArtifactSummaryWithEmptySpecScope = buildReportBuilderExplorationArtifactSummary({
    version: 1,
    kind: "reportBuilder.explorationArtifact",
    artifactId: "rbexploration_embedded_empty_scope_5101",
    title: "Embedded Exploration Demo",
    sourceSession: {
        sessionId: "rbexplore_embedded_5101",
        sourceRef: {
            kind: "reportBuilder.tableRow",
            contextLabel: "2026-05-01 • Display",
        },
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedExplorationDemo",
        title: "Embedded Exploration Demo",
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
                        { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Event Date", category: "Time" },
                        { id: "channelId", key: "channelId", semanticRef: "channel", label: "Channel", category: "Delivery" },
                    ],
                    measures: [
                        { id: "totalSpend", key: "totalSpend", semanticRef: "total_spend", label: "Total Spend", category: "Metrics", format: "currency" },
                        { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", category: "Metrics", format: "compactNumber" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Date Range",
                            description: "Embedded exploration scope.",
                            required: true,
                        },
                    ],
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date"],
                        selectedMeasures: ["total_spend"],
                    },
                },
                state: {
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
                        selectedDimensions: ["event_date", "channel"],
                        selectedMeasures: ["total_spend", "impressions"],
                    },
                    selectedDimensions: ["eventDate", "channelId"],
                    selectedMeasures: ["totalSpend", "impressions"],
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
});
assert.equal(embeddedSemanticArtifactSummaryWithEmptySpecScope.semanticBindingChips.includes("Dimensions Event Date, Channel"), true);
assert.equal(embeddedSemanticArtifactSummaryWithEmptySpecScope.scopeSummaryText, "Date Range");

console.log("reportBuilderExplorationArtifact ✓ builds saved exploration artifacts from forked builder state");
