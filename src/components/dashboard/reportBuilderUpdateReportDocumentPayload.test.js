import assert from "node:assert/strict";

import {
    buildReportBuilderUpdateReportDocumentExpectedVersionState,
    buildReportBuilderUpdateReportDocumentPayload,
    buildReportBuilderUpdateReportDocumentPayloadFromBuilderState,
    buildReportBuilderUpdateReportDocumentPayloadDownload,
    buildReportBuilderUpdateReportDocumentPayloadInspectorState,
    buildReportBuilderUpdateReportDocumentPayloadSummary,
    resolveReportBuilderUpdateReportDocumentExpectedVersion,
    serializeReportBuilderUpdateReportDocumentPayload,
} from "./reportBuilderUpdateReportDocumentPayload.js";

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
        description: "Update payload metadata summary.",
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

assert.equal(resolveReportBuilderUpdateReportDocumentExpectedVersion("7"), 7);
assert.equal(resolveReportBuilderUpdateReportDocumentExpectedVersion("  "), 0);
assert.equal(resolveReportBuilderUpdateReportDocumentExpectedVersion("0"), 0);
assert.equal(resolveReportBuilderUpdateReportDocumentExpectedVersion("7.5"), 0);
assert.equal(resolveReportBuilderUpdateReportDocumentExpectedVersion("9e999"), 0);

assert.deepEqual(buildReportBuilderUpdateReportDocumentExpectedVersionState("7"), {
    draft: "7",
    expectedVersion: 7,
    valid: true,
    helperText: "Using expected version 7.",
});
assert.deepEqual(buildReportBuilderUpdateReportDocumentExpectedVersionState(""), {
    draft: "",
    expectedVersion: 0,
    valid: false,
    helperText: "Enter the saved document version to prepare an update payload.",
});
assert.deepEqual(buildReportBuilderUpdateReportDocumentExpectedVersionState("7.5"), {
    draft: "7.5",
    expectedVersion: 0,
    valid: false,
    helperText: "Expected version must be a positive integer.",
});

const payload = buildReportBuilderUpdateReportDocumentPayload(savedReportPayload, {
    expectedVersion: "7",
    updatedAt: 8000,
});
assert.deepEqual(payload, {
    version: 1,
    kind: "updateReportDocumentPayload",
    updatedAt: 8000,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    expectedVersion: 7,
    title: "Exploration Demo",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Update payload metadata summary.",
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

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadSummary(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Update payload metadata summary.",
    kind: "updateReportDocumentPayload",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
});

assert.match(
    serializeReportBuilderUpdateReportDocumentPayload(payload),
    /"kind": "updateReportDocumentPayload"/,
);
assert.match(
    serializeReportBuilderUpdateReportDocumentPayload(payload),
    /"expectedVersion": 7/,
);
assert.match(
    serializeReportBuilderUpdateReportDocumentPayload(payload),
    /"semanticSummary": \{/,
);
assert.doesNotMatch(
    serializeReportBuilderUpdateReportDocumentPayload(payload),
    /"reportSpec": \{/,
);

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadInspectorState(payload), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Update payload metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Update payload metadata summary.",
    kind: "updateReportDocumentPayload",
    reportId: "demoReportBuilder",
    expectedVersion: 7,
    payloadId: "rbreport_rbexploration_rbexplore_1000_5000",
    sourceArtifactId: "rbexploration_rbexplore_1000_5000",
    compileStatus: "clean",
    blockCount: 1,
    datasetCount: 1,
    content: serializeReportBuilderUpdateReportDocumentPayload(payload),
});

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadDownload(payload), {
    filename: "Exploration Demo-update-report-document-v7.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderUpdateReportDocumentPayload(payload),
});

assert.equal(buildReportBuilderUpdateReportDocumentPayload(savedReportPayload, { expectedVersion: "" }), null);
assert.equal(buildReportBuilderUpdateReportDocumentPayload(null, { expectedVersion: 7 }), null);
assert.equal(
    buildReportBuilderUpdateReportDocumentPayload(invalidSavedReportPayload, { expectedVersion: 7 })?.compileState?.status,
    "clean",
);
assert.equal(
    buildReportBuilderUpdateReportDocumentPayload(invalidSavedReportPayload, { expectedVersion: 7 })?.compileState?.diagnostics?.[0]?.code,
    undefined,
);
assert.equal(
    buildReportBuilderUpdateReportDocumentPayload({
        ...invalidSavedReportPayload,
        compileState: {
            status: "clean",
            reportSpecVersion: 1,
            blockCount: 1,
            datasetCount: 1,
        },
    }, { expectedVersion: 7 })?.compileState?.diagnostics?.[0]?.code,
    undefined,
);

const derivedUpdatePayload = buildReportBuilderUpdateReportDocumentPayloadFromBuilderState({
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
            code: "missingSemanticRef",
            severity: "error",
            path: "siteType",
            message: "siteType is not mapped to the current semantic model.",
            suggestedFix: "Remove it or add a valid semantic mapping before running the report.",
        },
    ],
    expectedVersion: 9,
    updatedAt: 9430,
});

assert.equal(derivedUpdatePayload.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(derivedUpdatePayload.document.blocks[0].config.measures[0].label, "Available Impressions");
assert.equal(derivedUpdatePayload.document.blocks[0].config.dimensions[0].label, "Delivery Date");
assert.equal(derivedUpdatePayload.compileState.diagnostics[0].code, "missingSemanticRef");
assert.equal(derivedUpdatePayload.compileState.status, "invalid");
assert.equal(derivedUpdatePayload.expectedVersion, 9);
assert.equal(derivedUpdatePayload.updatedAt, 9430);
assert.equal(buildReportBuilderUpdateReportDocumentPayloadSummary(null), null);
assert.equal(serializeReportBuilderUpdateReportDocumentPayload(null), "");
assert.equal(buildReportBuilderUpdateReportDocumentPayloadInspectorState(null), null);
assert.equal(buildReportBuilderUpdateReportDocumentPayloadDownload(null), null);

console.log("reportBuilderUpdateReportDocumentPayload ✓ adapts saved builder payloads into updateReportDocument requests with explicit expected versions");
