import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderUpdateReportDocumentExpectedVersionState,
    buildReportBuilderUpdateReportDocumentPayload,
    buildReportBuilderUpdateReportDocumentPayloadFromBuilderState,
    buildReportBuilderUpdateReportDocumentPayloadDownload,
    buildReportBuilderUpdateReportDocumentPayloadInspectorState,
    buildReportBuilderUpdateReportDocumentPayloadSummary,
    mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact,
    resolveReportBuilderUpdateReportDocumentPayloadSeed,
    resolveReportBuilderUpdateReportDocumentExpectedVersion,
    serializeReportBuilderUpdateReportDocumentPayload,
} from "./reportBuilderUpdateReportDocumentPayload.js";
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
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for update payload metadata.",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Revenue Operations",
            entity: "store_performance",
            entityLabel: "Store Performance",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Transaction Date" },
                { id: "channel", rawId: "channelV2", label: "Category" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Net Revenue", format: "compactNumber" },
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
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for update payload metadata.",
                    value: {
                        start: "2026-05-01",
                        end: "2026-05-04",
                    },
                },
            ],
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Revenue Operations",
            entity: "store_performance",
            entityLabel: "Store Performance",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Transaction Date" },
                { id: "channel", rawId: "channelV2", label: "Category" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Net Revenue", format: "compactNumber" },
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
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Revenue Operations",
        "Entity Store Performance",
        "Dimensions Transaction Date, Category",
        "Measures Net Revenue",
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for update payload metadata.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Transaction Date" },
                { id: "channel", rawId: "channelV2", label: "Category" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Net Revenue", format: "compactNumber" },
            ],
        },
    ],
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
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Revenue Operations",
        "Entity Store Performance",
        "Dimensions Transaction Date, Category",
        "Measures Net Revenue",
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for update payload metadata.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (2)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Transaction Date" },
                { id: "channel", rawId: "channelV2", label: "Category" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Net Revenue", format: "compactNumber" },
            ],
        },
    ],
    content: serializeReportBuilderUpdateReportDocumentPayload(payload),
});

const mergedUpdatePayload = mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact(payload, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    documentVersion: 9,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(mergedUpdatePayload?.source?.kind, "reportBuilder.savedReportPayload");
assert.equal(mergedUpdatePayload?.source?.sourceArtifactId, "rbexploration_rbexplore_1000_5000");
assert.equal(mergedUpdatePayload?.expectedVersion, 7);
const sourceLessMergedUpdatePayload = mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact({
    ...payload,
    source: undefined,
}, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    documentVersion: 9,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(sourceLessMergedUpdatePayload?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(sourceLessMergedUpdatePayload?.source?.sourceArtifactId, "published_snapshot_demo_report");
assert.equal(sourceLessMergedUpdatePayload?.expectedVersion, 9);
const nonMatchingMergedUpdatePayload = mergeReportBuilderUpdateReportDocumentPayloadSharedArtifact({
    ...payload,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report",
        reportId: "demoReportBuilder",
    },
}, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    documentVersion: 9,
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(nonMatchingMergedUpdatePayload?.source?.kind, "reportBuilder.savedView");
assert.equal(nonMatchingMergedUpdatePayload?.source?.sourceArtifactId, "saved_view_demo_report");
assert.equal(nonMatchingMergedUpdatePayload?.expectedVersion, 7);

const savedViewBackedUpdatePayloadSummary = buildReportBuilderUpdateReportDocumentPayloadSummary({
    version: 1,
    kind: "updateReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
    expectedVersion: 8,
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
        sourceArtifactId: "saved_view_capacity_q3",
        reportId: "capacityQ3",
    },
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                sourceArtifactId: "saved_view_capacity_q3",
                reportId: "capacityQ3",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
        {
            reportId: "capacityQ3",
            documentVersion: 7,
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
    ],
});
assert.deepEqual(savedViewBackedUpdatePayloadSummary.savedViewOverlayChips, [
    "table view",
    "Base v7",
]);
assert.deepEqual(savedViewBackedUpdatePayloadSummary.reopenSourceResolutionChips, [
    "Base report file capacity_q3_base • capacityQ3",
]);

const sourceLessSavedViewBackedUpdatePayloadSummary = buildReportBuilderUpdateReportDocumentPayloadSummary({
    version: 1,
    kind: "updateReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
    expectedVersion: 8,
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
    source: undefined,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                sourceArtifactId: "saved_view_capacity_q3",
                reportId: "capacityQ3",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
    ],
});
assert.deepEqual(sourceLessSavedViewBackedUpdatePayloadSummary.savedViewOverlayChips, [
    "table view",
    "Base v7",
]);
assert.equal(sourceLessSavedViewBackedUpdatePayloadSummary.reopenSourceResolutionTitle, undefined);

const ambiguousSourceLessUpdatePayloadSummary = buildReportBuilderUpdateReportDocumentPayloadSummary({
    version: 1,
    kind: "updateReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
    expectedVersion: 8,
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
    source: undefined,
}, {
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            documentVersion: 8,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                sourceArtifactId: "saved_view_capacity_q3",
                reportId: "capacityQ3",
            },
            savedViewOverlay: {
                baseReportRef: {
                    artifactRef: "report://capacityQ3",
                    reportId: "capacityQ3",
                    documentVersion: 7,
                },
                overlay: {
                    presentation: {
                        viewMode: "table",
                    },
                },
            },
        },
        {
            reportId: "capacityQ3",
            documentVersion: 9,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_capacity_q3",
                reportId: "capacityQ3",
            },
        },
    ],
});
assert.equal(ambiguousSourceLessUpdatePayloadSummary.savedViewOverlayTitle, undefined);
assert.equal(ambiguousSourceLessUpdatePayloadSummary.reopenSourceResolutionTitle, undefined);

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadDownload(payload), {
    filename: "Exploration Demo-update-report-document-v7.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderUpdateReportDocumentPayload(payload),
});

const thinUpdatePayloadWithSpecMetadata = {
    version: 1,
    kind: "updateReportDocumentPayload",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    title: "Capacity Trend Q3",
    expectedVersion: 7,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        subtitle: "Imported update payload",
        description: "Thin document with semantic metadata only on reportSpec.",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Imported Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Imported Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Imported Delivery Date", category: "Time" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Imported Available Impressions", category: "Metrics" },
            ],
            selectedParameters: [
                { id: "reporting_window", rawId: "dateRange", label: "Imported Reporting Window", category: "Scope" },
            ],
        },
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Imported Reporting Window",
                    description: "Imported scope from reportSpec.",
                },
            ],
        },
    },
    compileState: {
        status: "clean",
        blockCount: 2,
        datasetCount: 1,
    },
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_channel_trend",
        sourceArtifactId: "capacity_q3_channel_trend",
    },
};

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadSummary(thinUpdatePayloadWithSpecMetadata), {
    title: "Capacity Trend Q3",
    subtitle: "Imported update payload",
    description: "Thin document with semantic metadata only on reportSpec.",
    kind: "updateReportDocumentPayload",
    reportId: "capacityTrendQ3",
    expectedVersion: 7,
    payloadId: "rbreport_capacity_q3_channel_trend",
    sourceArtifactId: "capacity_q3_channel_trend",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Imported Ad Delivery",
        "Entity Imported Line Delivery",
        "Dimensions Imported Delivery Date",
        "Measures Imported Available Impressions",
        "Parameters Imported Reporting Window",
        "Categories Time, Metrics +1",
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Imported Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Imported Reporting Window",
            description: "Imported scope from reportSpec.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Imported Delivery Date", category: "Time" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Imported Available Impressions", category: "Metrics" },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                { id: "reporting_window", rawId: "dateRange", label: "Imported Reporting Window", category: "Scope" },
            ],
        },
    ],
});

assert.deepEqual(buildReportBuilderUpdateReportDocumentPayloadInspectorState(thinUpdatePayloadWithSpecMetadata), {
    title: "Capacity Trend Q3",
    subtitle: "Imported update payload",
    description: "Thin document with semantic metadata only on reportSpec.",
    headerSubtitle: "Imported update payload",
    headerDescription: "Thin document with semantic metadata only on reportSpec.",
    kind: "updateReportDocumentPayload",
    reportId: "capacityTrendQ3",
    expectedVersion: 7,
    payloadId: "rbreport_capacity_q3_channel_trend",
    sourceArtifactId: "capacity_q3_channel_trend",
    compileStatus: "clean",
    blockCount: 2,
    datasetCount: 1,
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Imported Ad Delivery",
        "Entity Imported Line Delivery",
        "Dimensions Imported Delivery Date",
        "Measures Imported Available Impressions",
        "Parameters Imported Reporting Window",
        "Categories Time, Metrics +1",
    ],
    scopeSummaryTitle: "Report Scope",
    scopeSummaryText: "Imported Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Imported Reporting Window",
            description: "Imported scope from reportSpec.",
        },
    ],
    semanticBindingFieldGroups: [
        {
            id: "dimensions",
            title: "Selected dimensions (1)",
            fields: [
                { id: "event_date", rawId: "eventDate", label: "Imported Delivery Date", category: "Time" },
            ],
        },
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                { id: "available_impressions", rawId: "avails", label: "Imported Available Impressions", category: "Metrics" },
            ],
        },
        {
            id: "parameters",
            title: "Selected parameters (1)",
            fields: [
                { id: "reporting_window", rawId: "dateRange", label: "Imported Reporting Window", category: "Scope" },
            ],
        },
    ],
    content: serializeReportBuilderUpdateReportDocumentPayload(thinUpdatePayloadWithSpecMetadata),
});

const embeddedSemanticUpdateSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_embedded_binding_update",
    sourceArtifactId: "embedded_binding_update",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedBindingUpdate",
        title: "Embedded Binding Update",
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
                            description: "Embedded update payload scope.",
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
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_embedded_binding_update",
        sourceArtifactId: "embedded_binding_update",
    },
};

const embeddedSemanticUpdatePayload = buildReportBuilderUpdateReportDocumentPayload(embeddedSemanticUpdateSavedReportPayload, {
    expectedVersion: 7,
    updatedAt: 9200,
});
assert.equal(embeddedSemanticUpdatePayload.document.semanticSummary.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedSemanticUpdatePayload.document.semanticSummary.selectedDimensions[1].label, "Channel");
assert.equal(embeddedSemanticUpdatePayload.document.scope.params[0].label, "Reporting Window");
assert.deepEqual(embeddedSemanticUpdatePayload.document.scope.params[0].value, {
    start: "2026-05-01",
    end: "2026-05-04",
});
assert.equal(
    buildReportBuilderUpdateReportDocumentPayloadSummary(embeddedSemanticUpdatePayload).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderUpdateReportDocumentPayloadInspectorState(embeddedSemanticUpdatePayload).scopeSummaryText,
    "Reporting Window",
);

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

const dependentDerivedUpdatePayload = buildReportBuilderUpdateReportDocumentPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_dependent_update_payload",
    savedAt: 9431,
    title: "Dependent Derived Update Demo",
    sourceArtifactId: "dependent_derived_update_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "dependentDerivedUpdateDemo",
        title: "Dependent Derived Update Demo",
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
    savedAt: 9432,
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
    expectedVersion: 10,
    updatedAt: 9433,
});

assert.equal(dependentDerivedUpdatePayload.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(dependentDerivedUpdatePayload.document.blocks[0].state.selectedMeasures[0], "runningCtvAvails");
assert.equal(dependentDerivedUpdatePayload.document.blocks[0].state.localCalculatedFields[0].id, "ctvAvails");
assert.equal(dependentDerivedUpdatePayload.document.blocks[0].state.localTableCalculations[0].id, "runningCtvAvails");
assert.equal(dependentDerivedUpdatePayload.document.blocks[0].state.localTableCalculations[0].compute.sourceField, "ctvAvails");
assert.equal(dependentDerivedUpdatePayload.document.blocks[0].config.measures[0].label, "Available Impressions");
assert.equal(dependentDerivedUpdatePayload.compileState.status, "clean");
assert.equal(dependentDerivedUpdatePayload.expectedVersion, 10);
assert.equal(dependentDerivedUpdatePayload.updatedAt, 9433);

assert.equal(buildReportBuilderUpdateReportDocumentPayloadSummary(null), null);
assert.equal(serializeReportBuilderUpdateReportDocumentPayload(null), "");
assert.equal(buildReportBuilderUpdateReportDocumentPayloadInspectorState(null), null);
assert.equal(buildReportBuilderUpdateReportDocumentPayloadDownload(null), null);

assert.deepEqual(resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        documentVersion: 6,
        savedSource: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3_channel_trend",
            sourceArtifactId: "capacity_q3_channel_trend",
        },
    },
    getReportDocumentResponse: null,
}), {
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
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3_channel_trend",
        sourceArtifactId: "capacity_q3_channel_trend",
    },
});
assert.deepEqual(resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload, {
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
assert.deepEqual(resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: null,
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
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: null,
    getReportDocumentResponse: null,
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderUpdateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: {
        reportId: "capacityTrendQ3",
        title: "Capacity Trend Q3",
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

const audienceUpdatePayload = buildReportBuilderUpdateReportDocumentPayload(audienceArtifactFixture.legacySavedReportPayload, {
    expectedVersion: 13,
    updatedAt: 9377,
});
assert.equal(audienceUpdatePayload.document.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(audienceUpdatePayload.document.semanticSummary.selectedMeasures[0].category, "Audience");
assert.equal(audienceUpdatePayload.document.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(audienceUpdatePayload.document.semanticSummary.selectedParameters[1].category, "Audience");
assert.equal(buildReportBuilderUpdateReportDocumentPayloadSummary(audienceUpdatePayload).semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(buildReportBuilderUpdateReportDocumentPayloadSummary(audienceUpdatePayload).semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(buildReportBuilderUpdateReportDocumentPayloadSummary(audienceUpdatePayload).scopeSummaryText, "Date Range • Channels • Audience Segment");

console.log("reportBuilderUpdateReportDocumentPayload ✓ adapts saved builder payloads into updateReportDocument requests with explicit expected versions");
