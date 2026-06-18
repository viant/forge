import assert from "node:assert/strict";

import {
    buildReportBuilderCreateReportDocumentPayload,
    buildReportBuilderCreateReportDocumentPayloadFromBuilderState,
    buildReportBuilderCreateReportDocumentPayloadDownload,
    buildReportBuilderCreateReportDocumentPayloadInspectorState,
    buildReportBuilderCreateReportDocumentPayloadSummary,
    resolveReportBuilderCreateReportDocumentPayloadSeed,
    serializeReportBuilderCreateReportDocumentPayload,
} from "./reportBuilderCreateReportDocumentPayload.js";

const savedReportPayload = {
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
        description: "Create payload metadata summary.",
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

const payload = buildReportBuilderCreateReportDocumentPayload(savedReportPayload, { createdAt: 7000 });
assert.deepEqual(payload, {
    version: 1,
    kind: "createReportDocumentPayload",
    createdAt: 7000,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Exploration Demo",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Create payload metadata summary.",
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
        sourceSession: {
            sessionId: "rbexplore_1000",
            sourceRef: {
                kind: "reportBuilder.tableRow",
                contextLabel: "2026-05-01 • Display",
            },
        },
    },
});

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadSummary(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Create payload metadata summary.",
    kind: "createReportDocumentPayload",
    reportId: "demoReportBuilder",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
});

assert.match(
    serializeReportBuilderCreateReportDocumentPayload(payload),
    /"kind": "createReportDocumentPayload"/,
);
assert.match(
    serializeReportBuilderCreateReportDocumentPayload(payload),
    /"document": \{/,
);
assert.match(
    serializeReportBuilderCreateReportDocumentPayload(payload),
    /"semanticSummary": \{/,
);
assert.doesNotMatch(
    serializeReportBuilderCreateReportDocumentPayload(payload),
    /"reportSpec": \{/,
);

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadInspectorState(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Create payload metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Create payload metadata summary.",
    kind: "createReportDocumentPayload",
    reportId: "demoReportBuilder",
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    content: serializeReportBuilderCreateReportDocumentPayload(payload),
});

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadDownload(payload), {
    filename: "Exploration Demo-create-report-document.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderCreateReportDocumentPayload(payload),
});

assert.equal(buildReportBuilderCreateReportDocumentPayload(null), null);
assert.equal(buildReportBuilderCreateReportDocumentPayloadSummary(null), null);
assert.equal(serializeReportBuilderCreateReportDocumentPayload(null), "");
assert.equal(buildReportBuilderCreateReportDocumentPayloadInspectorState(null), null);
assert.equal(buildReportBuilderCreateReportDocumentPayloadDownload(null), null);
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
        documentVersion: 6,
        savedSource: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_forecasting_q3_channel_trend",
            sourceArtifactId: "forecasting_q3_channel_trend",
        },
    },
    getReportDocumentResponse: null,
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingTrendQ3",
    },
    documentVersion: 6,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_forecasting_q3_channel_trend",
        sourceArtifactId: "forecasting_q3_channel_trend",
    },
});
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: null,
    getReportDocumentResponse: null,
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
        documentVersion: 0,
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
        reportId: "forecastingTrendQ3",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_fallback_source",
        sourceArtifactId: "fallback_source_artifact",
    },
});
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
    getReportDocumentResponse: {
        version: 1,
        kind: "getReportDocumentResponse",
        reportRef: {
            reportId: "forecastingTrendQ3",
        },
        document: {
            version: 1,
            kind: "reportDocument",
            id: "forecastingTrendQ3",
            title: "Forecasting Trend Q3",
        },
    },
}), {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "forecastingTrendQ3",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "forecastingTrendQ3",
        title: "Forecasting Trend Q3",
    },
});
assert.equal(
    buildReportBuilderCreateReportDocumentPayloadSummary({
        title: "   ",
        document: { title: "   " },
        reportRef: { reportId: "demoReportBuilder" },
    })?.title,
    "demoReportBuilder",
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayload({
        ...savedReportPayload,
        payloadId: "",
        sourceArtifactId: "",
        sourceSession: null,
    })?.source?.payloadId,
    undefined,
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayload(invalidSavedReportPayload)?.compileState?.status,
    "clean",
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayload(invalidSavedReportPayload)?.compileState?.diagnostics?.[0]?.code,
    undefined,
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayload({
        ...invalidSavedReportPayload,
        compileState: {
            status: "clean",
            reportSpecVersion: 1,
            blockCount: 1,
            datasetCount: 1,
        },
    })?.compileState?.diagnostics?.[0]?.code,
    undefined,
);

const explicitSemanticSummaryCreatePayload = buildReportBuilderCreateReportDocumentPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_semantic_override",
    savedAt: 9300,
    title: "Semantic Override Demo",
    sourceArtifactId: "semantic_override_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "semanticOverrideDemo",
        title: "Semantic Override Demo",
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
            selectedDimensions: ["event_date"],
            selectedMeasures: ["available_impressions"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
        viewMode: "table",
        binding: {
            mode: "semantic",
            modelRef: "model://steward/performance/ad_delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://steward/performance/ad_delivery@v1",
        modelLabel: "Explicit Summary",
        entity: "line_delivery",
        entityLabel: "Explicit Entity",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Explicit Date" },
        ],
        selectedMeasures: [
            { id: "available_impressions", rawId: "avails", label: "Explicit Avails", format: "compactNumber" },
        ],
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
                ],
                measures: [
                    { id: "available_impressions", label: "Available Impressions", format: "compactNumber" },
                ],
            },
        ],
    },
    createdAt: 9415,
});

assert.equal(explicitSemanticSummaryCreatePayload.document.semanticSummary.modelLabel, "Explicit Summary");
assert.equal(explicitSemanticSummaryCreatePayload.document.semanticSummary.entityLabel, "Explicit Entity");
assert.equal(explicitSemanticSummaryCreatePayload.document.semanticSummary.selectedMeasures[0].label, "Explicit Avails");

const derivedCreatePayload = buildReportBuilderCreateReportDocumentPayloadFromBuilderState({
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
    createdAt: 9420,
});

assert.equal(derivedCreatePayload.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedCreatePayload.document.blocks[0].config.measures[0].label, "Available Impressions");
assert.equal(derivedCreatePayload.document.blocks[0].config.dimensions[0].label, "Delivery Date");
assert.equal(derivedCreatePayload.compileState.diagnostics[0].code, "semanticProviderDiagnostics");
assert.equal(derivedCreatePayload.createdAt, 9420);
assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadDownload({
    reportRef: { reportId: "forecasting/q2" },
    document: { title: "Forecasting Q2" },
    compileState: { status: "clean", blockCount: 1, datasetCount: 1 },
}), {
    filename: "Forecasting Q2-create-report-document.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderCreateReportDocumentPayload({
        reportRef: { reportId: "forecasting/q2" },
        document: { title: "Forecasting Q2" },
        compileState: { status: "clean", blockCount: 1, datasetCount: 1 },
    }),
});

console.log("reportBuilderCreateReportDocumentPayload ✓ adapts saved builder payloads into createReportDocument requests");
