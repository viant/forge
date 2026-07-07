import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderGetReportDocumentRequest,
    buildReportBuilderGetReportDocumentRequestDownload,
    buildReportBuilderGetReportDocumentRequestInspectorState,
    buildReportBuilderGetReportDocumentRequestSummary,
    serializeReportBuilderGetReportDocumentRequest,
} from "./reportBuilderGetReportDocumentRequest.js";
import {
    buildReportBuilderListReportDocumentsEntrySelectionKey,
    buildReportBuilderListReportDocumentsEntrySummary,
    buildReportBuilderListReportDocumentsResponse,
} from "./reportBuilderReportDocumentReadResponse.js";
const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const listResponse = {
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
        },
        {
            reportRef: { reportId: "capacityQ3" },
            documentVersion: 4,
            title: "Capacity Q3",
        },
    ],
};

const request = buildReportBuilderGetReportDocumentRequest(listResponse, {
    entryReportId: "capacityQ3",
});
assert.deepEqual(request, {
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "capacityQ3",
    },
    listEntrySelectionKey: "capacityQ3",
});

const duplicateListResponse = {
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
        {
            reportRef: { reportId: "capacityShared" },
            documentVersion: 9,
            title: "Capacity Shared Published Snapshot",
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityShared",
                sourceArtifactId: "published_snapshot_capacity_shared",
            },
        },
    ],
};
const duplicateRequest = buildReportBuilderGetReportDocumentRequest(duplicateListResponse, {
    entryReportId: "capacityShared",
    entrySelectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(duplicateListResponse.entries[1]),
});
assert.deepEqual(duplicateRequest, {
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "capacityShared",
    },
    source: {
        kind: "reportBuilder.publishedSnapshot",
        reportId: "capacityShared",
        sourceArtifactId: "published_snapshot_capacity_shared",
    },
    listEntrySelectionKey: "capacityShared::reportBuilder.publishedSnapshot::::published_snapshot_capacity_shared",
});
assert.equal(buildReportBuilderGetReportDocumentRequest(duplicateListResponse, {
    entryReportId: "capacityShared",
}), null);

const ambiguousSelectedEntrySummary = buildReportBuilderListReportDocumentsEntrySummary({
    reportRef: { reportId: "capacityShared" },
    documentVersion: 9,
    title: "Capacity Shared",
}, {
    localSavedPayloads: [
        {
            reportId: "capacityShared",
            title: "Capacity Shared Saved View",
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
        },
        {
            reportId: "capacityShared",
            title: "Capacity Shared Published Snapshot",
            documentVersion: 9,
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
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary({
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "capacityShared",
    },
}, {
    metadata: ambiguousSelectedEntrySummary,
}), {
    kind: "getReportDocumentRequest",
    reportId: "capacityShared",
    title: "Capacity Shared",
    localBackingAvailability: "ambiguous",
    localBackingLabel: "ambiguous local backing",
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary(request), {
    kind: "getReportDocumentRequest",
    reportId: "capacityQ3",
});
assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary(request, {
    metadata: {
        title: "Capacity Q3",
        subtitle: "Inventory Ladder",
        description: "Selected request metadata.",
        scopeSummaryTitle: "Filters",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for selected request metadata.",
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
    },
}), {
    kind: "getReportDocumentRequest",
    reportId: "capacityQ3",
    title: "Capacity Q3",
    subtitle: "Inventory Ladder",
    description: "Selected request metadata.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for selected request metadata.",
        },
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
});
assert.deepEqual(buildReportBuilderGetReportDocumentRequestSummary(request, {
    metadata: {
        title: "Capacity Q3",
        semanticBindingTitle: "Semantic Binding",
        semanticBindingFieldGroups: [
            {
                id: "measures",
                title: "Selected measures (1)",
                fields: [
                    {
                        id: "available_impressions",
                        rawId: "avails",
                        label: "Available Impressions",
                    },
                ],
            },
        ],
    },
}), {
    kind: "getReportDocumentRequest",
    reportId: "capacityQ3",
    title: "Capacity Q3",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingFieldGroups: [
        {
            id: "measures",
            title: "Selected measures (1)",
            fields: [
                {
                    id: "available_impressions",
                    rawId: "avails",
                    label: "Available Impressions",
                },
            ],
        },
    ],
});

const staleCarriedRequestSummary = buildReportBuilderGetReportDocumentRequestSummary(request, {
    metadata: {
        title: "Capacity Q3",
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
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions" },
            ],
        },
        semanticBindingTitle: "Semantic Binding",
        semanticBindingChips: [
            "Model model://example/performance/delivery@v1",
            "Measures available_impressions",
        ],
        semanticBindingFieldGroups: [
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
});
assert.deepEqual(staleCarriedRequestSummary.semanticBindingChips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date",
    "Measures Canonical Available Impressions",
]);
assert.deepEqual(staleCarriedRequestSummary.semanticBindingFieldGroups, [
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
            { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions" },
        ],
    },
]);

const richerCarriedRequestSummary = buildReportBuilderGetReportDocumentRequestSummary(request, {
    metadata: {
        title: "Capacity Q3",
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
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions" },
            ],
        },
        semanticBindingTitle: "Semantic Binding",
        modelLabel: "Carried Ad Delivery",
        entityLabel: "Carried Line Delivery",
        semanticBindingChips: [
            "Model Carried Ad Delivery",
            "Entity Carried Line Delivery",
            "Dimensions Carried Delivery Date",
            "Measures Carried Available Impressions",
        ],
        semanticBindingFieldGroups: [
            {
                id: "dimensions",
                title: "Selected dimensions (1)",
                fields: [
                    {
                        id: "event_date",
                        rawId: "eventDate",
                        label: "Carried Delivery Date",
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
                        label: "Carried Available Impressions",
                        definitionRef: "semantic://example/available_impressions",
                    },
                ],
            },
            {
                id: "parameters",
                title: "Selected parameters (1)",
                fields: [
                    {
                        id: "reporting_window",
                        rawId: "dateRange",
                        label: "Carried Reporting Window",
                        category: "Scope",
                        definitionRef: "semantic://example/reporting_window",
                        description: "Carried reporting window",
                    },
                ],
            },
        ],
    },
});
assert.deepEqual(richerCarriedRequestSummary.semanticBindingChips, [
    "Model Carried Ad Delivery",
    "Entity Carried Line Delivery",
    "Dimensions Carried Delivery Date",
    "Measures Carried Available Impressions",
]);

assert.match(
    serializeReportBuilderGetReportDocumentRequest(request),
    /"kind": "getReportDocumentRequest"/,
);

assert.deepEqual(buildReportBuilderGetReportDocumentRequestInspectorState(request, {
    metadata: {
        title: "Capacity Q3",
        subtitle: "Inventory Ladder",
        description: "Selected request metadata.",
        scopeSummaryTitle: "Filters",
        scopeSummaryText: "Reporting Window",
        scopeSummaryItems: [
            {
                id: "dateRange",
                label: "Reporting Window",
                description: "Approved reporting window for selected request metadata.",
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
    },
}), {
    kind: "getReportDocumentRequest",
    reportId: "capacityQ3",
    title: "Capacity Q3",
    subtitle: "Inventory Ladder",
    description: "Selected request metadata.",
    semanticBindingTitle: "Semantic Binding",
    semanticBindingChips: [
        "Model Ad Delivery",
        "Entity Line Delivery",
        "Dimensions Delivery Date, Channel",
        "Measures Available Impressions",
    ],
    scopeSummaryTitle: "Filters",
    scopeSummaryText: "Reporting Window",
    scopeSummaryItems: [
        {
            id: "dateRange",
            label: "Reporting Window",
            description: "Approved reporting window for selected request metadata.",
        },
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
    headerSubtitle: "Inventory Ladder",
    headerDescription: "Selected request metadata.",
    content: serializeReportBuilderGetReportDocumentRequest(request),
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestInspectorState({
    version: 1,
    kind: "getReportDocumentRequest",
    reportRef: {
        reportId: "capacityShared",
    },
}, {
    metadata: ambiguousSelectedEntrySummary,
}), {
    kind: "getReportDocumentRequest",
    reportId: "capacityShared",
    title: "Capacity Shared",
    localBackingAvailability: "ambiguous",
    localBackingLabel: "ambiguous local backing",
    content: serializeReportBuilderGetReportDocumentRequest({
        version: 1,
        kind: "getReportDocumentRequest",
        reportRef: {
            reportId: "capacityShared",
        },
    }),
});

assert.deepEqual(buildReportBuilderGetReportDocumentRequestDownload(request, {
    metadata: {
        title: "Capacity Q3",
    },
}), {
    filename: "Capacity Q3-get-report-document-request.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderGetReportDocumentRequest(request),
});

const audienceRequest = buildReportBuilderGetReportDocumentRequest(audienceArtifactFixture.listReportDocumentsResponse, {
    entryReportId: "capacityAudienceSegmentIndexQ3",
});
const audienceMetadata = buildReportBuilderListReportDocumentsEntrySummary(audienceArtifactFixture.listReportDocumentsResponse.entries[0], {
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9379,
            savedReportPayload: audienceArtifactFixture.savedReportPayload,
        },
    ],
});
assert.equal(buildReportBuilderGetReportDocumentRequestSummary(audienceRequest, {
    metadata: audienceMetadata,
}).semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(buildReportBuilderGetReportDocumentRequestSummary(audienceRequest, {
    metadata: audienceMetadata,
}).semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(buildReportBuilderGetReportDocumentRequestSummary(audienceRequest, {
    metadata: audienceMetadata,
}).scopeSummaryText, "Date Range • Channels • Audience Segment");

const embeddedMetadataRequest = buildReportBuilderGetReportDocumentRequest(listResponse, {
    entryReportId: "capacityQ3",
});
const embeddedMetadataContext = {
    reportSpec: {
        version: 1,
        kind: "reportSpec",
    },
    document: {
        version: 1,
        kind: "reportDocument",
        id: "embeddedMetadataTrendQ3",
        title: "Embedded Metadata Trend Q3",
        subtitle: "Embedded metadata",
        description: "Derived directly from the document payload.",
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
                        { id: "avails", key: "avails", semanticRef: "available_impressions", label: "Available Impressions", category: "Metrics" },
                    ],
                    staticFilters: [
                        {
                            id: "dateRange",
                            type: "dateRange",
                            label: "Reporting Window",
                            description: "Embedded request scope metadata.",
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
};
assert.equal(
    buildReportBuilderGetReportDocumentRequestSummary(embeddedMetadataRequest, {
        metadata: embeddedMetadataContext,
    }).semanticBindingChips.includes("Dimensions Delivery Date, Channel"),
    true,
);
assert.equal(
    buildReportBuilderGetReportDocumentRequestSummary(embeddedMetadataRequest, {
        metadata: embeddedMetadataContext,
    }).scopeSummaryText,
    "Reporting Window",
);
assert.equal(
    buildReportBuilderGetReportDocumentRequestInspectorState(embeddedMetadataRequest, {
        metadata: embeddedMetadataContext,
    }).headerSubtitle,
    "Embedded metadata",
);

assert.equal(buildReportBuilderGetReportDocumentRequest(listResponse, { entryReportId: "" }), null);
assert.equal(buildReportBuilderGetReportDocumentRequest(listResponse, { entryReportId: "missing" }), null);
assert.equal(buildReportBuilderGetReportDocumentRequestSummary(null), null);
assert.equal(serializeReportBuilderGetReportDocumentRequest(null), "");
assert.equal(buildReportBuilderGetReportDocumentRequestInspectorState(null), null);
assert.equal(buildReportBuilderGetReportDocumentRequestDownload(null), null);

console.log("reportBuilderGetReportDocumentRequest ✓ derives getReportDocument requests from selected list entries");
