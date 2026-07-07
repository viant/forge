import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderCreateReportDocumentPayload,
    buildReportBuilderCreateReportDocumentPayloadFromBuilderState,
    buildReportBuilderCreateReportDocumentPayloadDownload,
    buildReportBuilderCreateReportDocumentPayloadInspectorState,
    buildReportBuilderCreateReportDocumentPayloadSummary,
    mergeReportBuilderCreateReportDocumentPayloadSharedArtifact,
    resolveReportBuilderCreateReportDocumentPayloadSeed,
    serializeReportBuilderCreateReportDocumentPayload,
} from "./reportBuilderCreateReportDocumentPayload.js";
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
        description: "Create payload metadata summary.",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for create payload metadata.",
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
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for create payload metadata.",
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
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Revenue Operations",
        "Entity Store Performance",
        "Dimensions Transaction Date, Category",
        "Measures Net Revenue",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for create payload metadata.",
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

const staleCarriedCreatePayloadSummary = buildReportBuilderCreateReportDocumentPayloadSummary({
    ...payload,
    semanticBindingViewState: {
        title: "Semantic Binding",
        chips: [
            "Model model://example/performance/delivery@v1",
            "Measures available_impressions",
        ],
        fieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "available_impressions",
                        rawId: "available_impressions",
                        label: "available_impressions",
                    },
                ],
            },
        ],
    },
    document: {
        ...payload.document,
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
                { id: "channel", rawId: "channelV2", label: "Canonical Channel" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions", format: "compactNumber" },
            ],
        },
    },
});
assert.deepEqual(staleCarriedCreatePayloadSummary.semanticBindingChips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date, Canonical Channel",
    "Measures Canonical Available Impressions",
]);

const richerCarriedCreatePayloadSummary = buildReportBuilderCreateReportDocumentPayloadSummary({
    ...payload,
    semanticBindingViewState: {
        title: "Semantic Binding",
        modelLabel: "Carried Revenue Operations",
        entityLabel: "Carried Store Performance",
        chips: [
            "Model Carried Revenue Operations",
            "Entity Carried Store Performance",
            "Dimensions Carried Transaction Date",
            "Measures Carried Net Revenue",
        ],
        fieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    {
                        id: "event_date",
                        rawId: "eventDate",
                        label: "Carried Transaction Date",
                        category: "Time",
                        definitionRef: "semantic://example/event_date",
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
                        label: "Carried Net Revenue",
                        format: "compactNumber",
                        definitionRef: "semantic://example/net_revenue",
                    },
                ],
            },
        ],
    },
});
assert.deepEqual(richerCarriedCreatePayloadSummary.semanticBindingChips, [
    "Model Carried Revenue Operations",
    "Entity Carried Store Performance",
    "Dimensions Carried Transaction Date",
    "Measures Carried Net Revenue",
]);

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
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Revenue Operations",
        "Entity Store Performance",
        "Dimensions Transaction Date, Category",
        "Measures Net Revenue",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for create payload metadata.",
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
    content: serializeReportBuilderCreateReportDocumentPayload(payload),
});

const mergedCreatePayload = mergeReportBuilderCreateReportDocumentPayloadSharedArtifact(payload, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(mergedCreatePayload?.source?.kind, "reportBuilder.savedReportPayload");
assert.equal(mergedCreatePayload?.source?.sourceArtifactId, "rbexploration_rbexplore_1000_5000");
const sourceLessMergedCreatePayload = mergeReportBuilderCreateReportDocumentPayloadSharedArtifact({
    ...payload,
    source: undefined,
}, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(sourceLessMergedCreatePayload?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(sourceLessMergedCreatePayload?.source?.sourceArtifactId, "published_snapshot_demo_report");
const nonMatchingMergedCreatePayload = mergeReportBuilderCreateReportDocumentPayloadSharedArtifact({
    ...payload,
    source: {
        kind: "reportBuilder.savedView",
        sourceArtifactId: "saved_view_demo_report",
        reportId: "demoReportBuilder",
    },
}, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "demoReportBuilder",
    source: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
});
assert.equal(nonMatchingMergedCreatePayload?.source?.kind, "reportBuilder.savedView");
assert.equal(nonMatchingMergedCreatePayload?.source?.sourceArtifactId, "saved_view_demo_report");

const savedViewBackedCreatePayloadSummary = buildReportBuilderCreateReportDocumentPayloadSummary({
    version: 1,
    kind: "createReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
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
assert.deepEqual(savedViewBackedCreatePayloadSummary.savedViewOverlayChips, [
    "table view",
    "Base v7",
]);
assert.deepEqual(savedViewBackedCreatePayloadSummary.reopenSourceResolutionChips, [
    "Base report file capacity_q3_base • capacityQ3",
]);

const sourceLessSavedViewBackedCreatePayloadSummary = buildReportBuilderCreateReportDocumentPayloadSummary({
    version: 1,
    kind: "createReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
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
assert.deepEqual(sourceLessSavedViewBackedCreatePayloadSummary.savedViewOverlayChips, [
    "table view",
    "Base v7",
]);
assert.equal(sourceLessSavedViewBackedCreatePayloadSummary.reopenSourceResolutionTitle, undefined);

const ambiguousSourceLessCreatePayloadSummary = buildReportBuilderCreateReportDocumentPayloadSummary({
    version: 1,
    kind: "createReportDocumentPayload",
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3 Saved View",
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
assert.equal(ambiguousSourceLessCreatePayloadSummary.savedViewOverlayTitle, undefined);
assert.equal(ambiguousSourceLessCreatePayloadSummary.reopenSourceResolutionTitle, undefined);

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadDownload(payload), {
    filename: "Exploration Demo-create-report-document.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderCreateReportDocumentPayload(payload),
});

const thinCreatePayloadWithSpecMetadata = {
    version: 1,
    kind: "createReportDocumentPayload",
    reportRef: {
        reportId: "capacityTrendQ3",
    },
    title: "Capacity Trend Q3",
    document: {
        version: 1,
        kind: "reportDocument",
        id: "capacityTrendQ3",
        title: "Capacity Trend Q3",
        subtitle: "Imported create payload",
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

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadSummary(thinCreatePayloadWithSpecMetadata), {
    title: "Capacity Trend Q3",
    subtitle: "Imported create payload",
    description: "Thin document with semantic metadata only on reportSpec.",
    kind: "createReportDocumentPayload",
    reportId: "capacityTrendQ3",
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
    scopeSummaryTitle: "Filters",
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

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadInspectorState(thinCreatePayloadWithSpecMetadata), {
    title: "Capacity Trend Q3",
    subtitle: "Imported create payload",
    description: "Thin document with semantic metadata only on reportSpec.",
    headerSubtitle: "Imported create payload",
    headerDescription: "Thin document with semantic metadata only on reportSpec.",
    kind: "createReportDocumentPayload",
    reportId: "capacityTrendQ3",
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
    scopeSummaryTitle: "Filters",
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
    content: serializeReportBuilderCreateReportDocumentPayload(thinCreatePayloadWithSpecMetadata),
});

const embeddedSemanticCreateSavedReportPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_embedded_binding_create",
    sourceArtifactId: "embedded_binding_create",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedBindingCreate",
        title: "Embedded Binding Create",
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
                            description: "Embedded create payload scope.",
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
    source: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_embedded_binding_create",
        sourceArtifactId: "embedded_binding_create",
    },
};

const embeddedSemanticCreatePayload = buildReportBuilderCreateReportDocumentPayload(embeddedSemanticCreateSavedReportPayload, {
    createdAt: 9100,
});
assert.equal(embeddedSemanticCreatePayload.document.semanticSummary.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedSemanticCreatePayload.document.semanticSummary.selectedDimensions[1].label, "Channel");
assert.equal(embeddedSemanticCreatePayload.document.scope.params[0].label, "Reporting Window");
assert.deepEqual(embeddedSemanticCreatePayload.document.scope.params[0].value, {
    start: "2026-05-01",
    end: "2026-05-04",
});
assert.equal(
    buildReportBuilderCreateReportDocumentPayloadSummary(embeddedSemanticCreatePayload).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayloadInspectorState(embeddedSemanticCreatePayload).scopeSummaryText,
    "Reporting Window",
);

assert.equal(buildReportBuilderCreateReportDocumentPayload(null), null);
assert.equal(buildReportBuilderCreateReportDocumentPayloadSummary(null), null);
assert.equal(serializeReportBuilderCreateReportDocumentPayload(null), "");
assert.equal(buildReportBuilderCreateReportDocumentPayloadInspectorState(null), null);
assert.equal(buildReportBuilderCreateReportDocumentPayloadDownload(null), null);
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
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
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
    hydratedReportDocumentSession: null,
    getReportDocumentResponse: null,
}), savedReportPayload);
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
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
assert.deepEqual(resolveReportBuilderCreateReportDocumentPayloadSeed(savedReportPayload, {
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
            modelRef: "model://example/performance/delivery@v1",
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
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date"],
            selectedMeasures: ["available_impressions"],
        },
    },
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
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
        modelRef: "model://example/performance/delivery@v1",
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

const canonicalFallbackCreatePayload = buildReportBuilderCreateReportDocumentPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_semantic_runtime_fallback",
    savedAt: 9421,
    title: "Semantic Runtime Fallback Demo",
    sourceArtifactId: "semantic_runtime_fallback_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "semanticRuntimeFallbackDemo",
        title: "Semantic Runtime Fallback Demo",
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
            { id: "totalSpend", key: "totalSpend", semanticRef: "spend", label: "Spend", default: true, format: "currency" },
            { id: "impressions", key: "impressions", semanticRef: "impressions", label: "Impressions", default: true, format: "compactNumber" },
        ],
        dimensions: [
            { id: "eventDate", key: "eventDate", semanticRef: "event_date", label: "Date", default: true, chartAxis: true, format: "date" },
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
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["spend", "impressions"],
        },
    },
    state: {
        selectedMeasures: ["totalSpend", "impressions"],
        primaryMeasure: "totalSpend",
        selectedDimensions: ["eventDate", "channelV2"],
        viewMode: "table",
        scopeParams: {
            dateRange: {
                start: "2026-06-19",
                end: "2026-06-25",
            },
        },
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
            selectedDimensions: ["event_date", "channel"],
            selectedMeasures: ["spend", "impressions"],
        },
    },
    semanticSummary: {
        kind: "semantic",
        modelRef: "model://example/performance/delivery@v1",
        modelLabel: "Canonical Ad Delivery",
        entity: "line_delivery",
        entityLabel: "Canonical Line Delivery",
        selectedDimensions: [
            { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date" },
            { id: "channel", rawId: "channelV2", label: "Canonical Channel" },
        ],
        selectedMeasures: [
            { id: "spend", rawId: "totalSpend", label: "Canonical Spend", format: "currency" },
            { id: "impressions", rawId: "impressions", label: "Canonical Impressions", format: "compactNumber" },
        ],
        selectedParameters: [
            { id: "reporting_window", rawId: "dateRange", label: "Canonical Reporting Window" },
        ],
    },
    semanticModel: null,
    createdAt: 9422,
});

assert.equal(canonicalFallbackCreatePayload.document.semanticSummary.modelLabel, "Canonical Ad Delivery");
assert.equal(canonicalFallbackCreatePayload.document.semanticSummary.entityLabel, "Canonical Line Delivery");
assert.equal(canonicalFallbackCreatePayload.document.semanticSummary.selectedDimensions[0].label, "Canonical Delivery Date");
assert.equal(canonicalFallbackCreatePayload.document.semanticSummary.selectedMeasures[0].label, "Canonical Spend");
assert.equal(
    buildReportBuilderCreateReportDocumentPayloadSummary(canonicalFallbackCreatePayload).semanticBindingChips.includes("Model Canonical Ad Delivery"),
    true,
);
assert.equal(
    buildReportBuilderCreateReportDocumentPayloadSummary(canonicalFallbackCreatePayload).semanticBindingChips.includes("Dimensions Canonical Delivery Date, Canonical Channel"),
    true,
);

const dependentDerivedCreatePayload = buildReportBuilderCreateReportDocumentPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_dependent_create_payload",
    savedAt: 9421,
    title: "Dependent Derived Create Demo",
    sourceArtifactId: "dependent_derived_create_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "dependentDerivedCreateDemo",
        title: "Dependent Derived Create Demo",
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
    savedAt: 9422,
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
    createdAt: 9423,
});

assert.equal(dependentDerivedCreatePayload.document.semanticSummary.modelLabel, "Ad Delivery");
assert.equal(dependentDerivedCreatePayload.document.blocks[0].state.selectedMeasures[0], "runningCtvAvails");
assert.equal(dependentDerivedCreatePayload.document.blocks[0].state.localCalculatedFields[0].id, "ctvAvails");
assert.equal(dependentDerivedCreatePayload.document.blocks[0].state.localTableCalculations[0].id, "runningCtvAvails");
assert.equal(dependentDerivedCreatePayload.document.blocks[0].state.localTableCalculations[0].compute.sourceField, "ctvAvails");
assert.equal(dependentDerivedCreatePayload.document.blocks[0].config.measures[0].label, "Available Impressions");
assert.equal(dependentDerivedCreatePayload.compileState.status, "clean");
assert.equal(dependentDerivedCreatePayload.compileState.reportSpecVersion, 1);
assert.equal(dependentDerivedCreatePayload.createdAt, 9423);

assert.deepEqual(buildReportBuilderCreateReportDocumentPayloadDownload({
    reportRef: { reportId: "capacity/q2" },
    document: { title: "Capacity Q2" },
    compileState: { status: "clean", blockCount: 1, datasetCount: 1 },
}), {
    filename: "Capacity Q2-create-report-document.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderCreateReportDocumentPayload({
        reportRef: { reportId: "capacity/q2" },
        document: { title: "Capacity Q2" },
        compileState: { status: "clean", blockCount: 1, datasetCount: 1 },
    }),
});

const audienceCreatePayload = buildReportBuilderCreateReportDocumentPayload(audienceArtifactFixture.legacySavedReportPayload, {
    createdAt: 9376,
});
assert.equal(audienceCreatePayload.document.semanticSummary.selectedMeasures[0].definitionRef, "harmonizer://feature/user.segment.index");
assert.equal(audienceCreatePayload.document.semanticSummary.selectedMeasures[0].category, "Audience");
assert.equal(audienceCreatePayload.document.semanticSummary.selectedParameters[1].definitionRef, "harmonizer://feature/user.segment");
assert.equal(audienceCreatePayload.document.semanticSummary.selectedParameters[1].category, "Audience");
assert.equal(buildReportBuilderCreateReportDocumentPayloadSummary(audienceCreatePayload).semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(buildReportBuilderCreateReportDocumentPayloadSummary(audienceCreatePayload).semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(buildReportBuilderCreateReportDocumentPayloadSummary(audienceCreatePayload).scopeSummaryText, "Date Range • Channels • Audience Segment");

console.log("reportBuilderCreateReportDocumentPayload ✓ adapts saved builder payloads into createReportDocument requests");
