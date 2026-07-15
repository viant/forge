import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    buildReportBuilderHydratedReportDocumentDiagnostic,
    buildReportBuilderHydratedReportDocumentDiagnosticDownload,
    buildReportBuilderHydratedReportDocumentDiagnosticInspectorState,
    buildReportBuilderHydratedReportDocumentDiagnosticSummary,
    buildReportBuilderListReportDocumentsEntryDiagnostic,
    mergeReportBuilderHydratedReportDocumentDiagnosticSharedArtifact,
    serializeReportBuilderHydratedReportDocumentDiagnostic,
} from "./reportBuilderHydratedReportDocumentDiagnostic.js";
import { buildReportBuilderListReportDocumentsEntrySelectionKey } from "./reportBuilderReportDocumentReadResponse.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const getResponse = {
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "demoReportBuilder",
    },
    documentVersion: 11,
    document: {
        version: 1,
        kind: "reportDocument",
        id: "demoReportBuilder",
        title: "Exploration Demo",
        subtitle: "Executive Snapshot",
        description: "Reopen diagnostic metadata summary.",
        scope: {
            params: [
                {
                    id: "dateRange",
                    label: "Reporting Window",
                    description: "Approved reporting window for reopen diagnostics.",
                },
            ],
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
                { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
            ],
        },
    },
    reportSpec: {
        kind: "reportSpec",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
    },
};

const hydrateResult = {
    valid: false,
    code: "incompatibleSource",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
};

const diagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, hydrateResult, {
    detectedAt: 9100,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});

assert.deepEqual(diagnostic, {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    detectedAt: 9100,
    reportRef: {
        reportId: "demoReportBuilder",
    },
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    responseKind: "getReportDocumentResponse",
    responseVersion: 1,
    documentKind: "reportDocument",
    documentVersion: 11,
    documentSchemaVersion: 1,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
    suggestedAction: "Open this report from a compatible builder target or reload a matching report artifact.",
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
            description: "Approved reporting window for reopen diagnostics.",
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
    source: {
        kind: "dashboard.reportBuilder",
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
});

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticSummary(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "demoReportBuilder",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
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
            description: "Approved reporting window for reopen diagnostics.",
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

const overlayBackedDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, {
    ...hydrateResult,
    savedViewOverlayBaseSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_demo_report_base",
        sourceArtifactId: "demo_report_base",
        reportId: "demoReportBuilder",
    },
    savedViewOverlayPublishedSnapshotSource: {
        kind: "reportBuilder.publishedSnapshot",
        sourceArtifactId: "published_snapshot_demo_report",
        reportId: "demoReportBuilder",
    },
}, {
    detectedAt: 9105,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticSummary(overlayBackedDiagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "demoReportBuilder",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
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
            description: "Approved reporting window for reopen diagnostics.",
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
    reopenSourceResolutionTitle: "Resolved Reopen Sources",
    reopenSourceResolutionText: "Resolved reopen against the published snapshot and base report file.",
    reopenSourceResolutionChips: [
        "Published snapshot published_snapshot_demo_report • demoReportBuilder",
        "Base report file demo_report_base • demoReportBuilder",
    ],
    reopenSourceResolutionSources: [
        {
            id: "publishedSnapshot",
            label: "Published snapshot",
            value: "published_snapshot_demo_report • demoReportBuilder",
            source: {
                kind: "reportBuilder.publishedSnapshot",
                sourceArtifactId: "published_snapshot_demo_report",
                reportId: "demoReportBuilder",
            },
        },
        {
            id: "baseReport",
            label: "Base report file",
            value: "demo_report_base • demoReportBuilder",
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_demo_report_base",
                sourceArtifactId: "demo_report_base",
                reportId: "demoReportBuilder",
            },
        },
    ],
});

const reportIdOnlyOverlayBackedDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, {
    ...hydrateResult,
    savedViewOverlayBaseSource: {
        kind: "reportBuilder.savedReportPayload",
        reportId: "demoReportBuilder",
    },
}, {
    detectedAt: 9106,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.deepEqual(reportIdOnlyOverlayBackedDiagnostic.reopenSourceResolutionChips, [
    "Base report file demoReportBuilder",
]);

assert.match(
    serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
    /"kind": "reportBuilder\.reopenDiagnostic"/,
);
assert.doesNotMatch(
    serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
    /"config": \{/,
);

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(diagnostic), {
    title: "Exploration Demo",
    subtitle: "Executive Snapshot",
    description: "Reopen diagnostic metadata summary.",
    headerSubtitle: "Executive Snapshot",
    headerDescription: "Reopen diagnostic metadata summary.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "demoReportBuilder",
    message: "This ReportDocument targets a different builder source: data source demoReportSource.",
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
            description: "Approved reporting window for reopen diagnostics.",
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
    content: serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
});

const staleCarriedReopenDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic({
    ...getResponse,
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
        ...getResponse.document,
        semanticSummary: {
            kind: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            modelLabel: "Canonical Ad Delivery",
            entity: "line_delivery",
            entityLabel: "Canonical Line Delivery",
            selectedDimensions: [
                { id: "event_date", rawId: "eventDate", label: "Canonical Delivery Date", category: "Time" },
            ],
            selectedMeasures: [
                { id: "available_impressions", rawId: "avails", label: "Canonical Available Impressions" },
            ],
        },
    },
}, hydrateResult, {
    detectedAt: 9101,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.deepEqual(staleCarriedReopenDiagnostic.semanticBindingChips, [
    "Model Canonical Ad Delivery",
    "Entity Canonical Line Delivery",
    "Dimensions Canonical Delivery Date",
    "Measures Canonical Available Impressions",
    "Categories Time",
]);

const richerCarriedReopenDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic({
    ...getResponse,
    semanticBindingViewState: {
        title: "Semantic Binding",
        modelLabel: "Carried Ad Delivery",
        entityLabel: "Carried Line Delivery",
        chips: [
            "Model Carried Ad Delivery",
            "Entity Carried Line Delivery",
            "Dimensions Carried Delivery Date",
            "Measures Carried Available Impressions",
        ],
        fieldGroups: [
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
        ],
    },
}, hydrateResult, {
    detectedAt: 9102,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.deepEqual(richerCarriedReopenDiagnostic.semanticBindingChips, [
    "Model Carried Ad Delivery",
    "Entity Carried Line Delivery",
    "Dimensions Carried Delivery Date",
    "Measures Carried Available Impressions",
]);

assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticDownload(diagnostic), {
    filename: "Exploration Demo-reopen-diagnostic.json",
    mimeType: "application/json;charset=utf-8",
    payload: serializeReportBuilderHydratedReportDocumentDiagnostic(diagnostic),
});

const audienceLegacyGetResponse = {
    ...audienceArtifactFixture.legacyGetReportDocumentResponse,
    reportSpec: audienceArtifactFixture.getReportDocumentResponse.reportSpec,
};
const audienceReopenDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic(
    audienceLegacyGetResponse,
    hydrateResult,
    {
        detectedAt: 9381,
        builderIdentity: {
            containerId: "demoReportBuilder",
            stateKey: "demoReportBuilder",
            dataSourceRef: "otherSource",
        },
    },
);
assert.equal(audienceReopenDiagnostic.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceReopenDiagnostic.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceReopenDiagnostic.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceReopenDiagnostic.semanticBindingFieldGroups[1].fields[0].definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    audienceReopenDiagnostic.semanticBindingFieldGroups[2].fields[1].definitionRef,
    "harmonizer://feature/user.segment",
);

const embeddedDocumentOnlyDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "embeddedBindingTrendQ3",
    },
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
                            description: "Embedded diagnostic scope metadata.",
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
}, hydrateResult, {
    detectedAt: 9382,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.equal(embeddedDocumentOnlyDiagnostic.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedDocumentOnlyDiagnostic.scopeSummaryText, "Reporting Window");
assert.equal(embeddedDocumentOnlyDiagnostic.scopeSummaryItems[0].description, "Embedded diagnostic scope metadata.");

const embeddedDocumentEmptySpecDiagnostic = buildReportBuilderHydratedReportDocumentDiagnostic({
    version: 1,
    kind: "getReportDocumentResponse",
    reportRef: {
        reportId: "embeddedBindingTrendQ3",
    },
    documentVersion: 4,
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
                            description: "Embedded diagnostic scope metadata.",
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
}, hydrateResult, {
    detectedAt: 9382,
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "otherSource",
    },
});
assert.equal(embeddedDocumentEmptySpecDiagnostic.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedDocumentEmptySpecDiagnostic.scopeSummaryText, "Reporting Window");
assert.equal(embeddedDocumentEmptySpecDiagnostic.scopeSummaryItems[0].description, "Embedded diagnostic scope metadata.");

const listDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "demoReportBuilder",
                stateKey: "demoReportBuilder",
                dataSourceRef: "demoReportSource",
            },
        },
        {
            reportRef: { reportId: "capacityQ3" },
            documentVersion: 4,
            title: "Capacity Q3",
            subtitle: "Inventory Ladder",
            description: "Selected list entry metadata.",
        },
    ],
}, {
    entryReportId: "capacityQ3",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    detectedAt: 9200,
    localSavedPayloads: [
        {
            reportId: "capacityQ3",
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_inventory_ladder",
                sourceArtifactId: "capacity_q3_inventory_ladder",
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "capacityQ3",
                    title: "Capacity Q3",
                },
                reportSpec: {
                    kind: "reportSpec",
                    binding: {
                        mode: "semantic",
                        modelRef: "model://example/performance/delivery@v1",
                        entity: "line_delivery",
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
                            { id: "available_impressions", rawId: "avails", label: "Available Impressions" },
                        ],
                    },
                    scope: {
                        params: [
                            {
                                id: "dateRange",
                                label: "Reporting Window",
                                description: "Approved reporting window for selected list entry diagnostics.",
                            },
                        ],
                    },
                },
            },
        },
    ],
});
const embeddedListDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "embeddedBindingTrendQ3" },
            documentVersion: 4,
            title: "Embedded Binding Trend Q3",
        },
    ],
}, {
    entryReportId: "embeddedBindingTrendQ3",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    localSavedPayloads: [
        {
            reportId: "embeddedBindingTrendQ3",
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_embedded_binding_trend",
                sourceArtifactId: "embedded_binding_trend",
                reportDocument: {
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
                                        description: "Embedded diagnostic scope metadata.",
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
            },
        },
    ],
});
assert.equal(embeddedListDiagnostic.semanticBindingChips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(embeddedListDiagnostic.scopeSummaryText, "Reporting Window");

const audienceThinSavedPayload = {
    ...audienceArtifactFixture.legacySavedReportPayload,
};
delete audienceThinSavedPayload.reportSpec;
const audienceThinListDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityAudienceSegmentIndexQ3" },
            documentVersion: 13,
            title: "Capacity Audience Segment Index Q3",
        },
    ],
}, {
    entryReportId: "capacityAudienceSegmentIndexQ3",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    localSavedPayloads: [
        {
            documentVersion: 13,
            savedAt: 9383,
            importedArtifactKind: "reportBuilder.savedReportPayload",
            savedReportPayload: audienceThinSavedPayload,
        },
    ],
});
assert.equal(audienceThinListDiagnostic.semanticBindingChips.includes("Measures Audience Index"), true);
assert.equal(audienceThinListDiagnostic.semanticBindingChips.includes("Parameters Date Range, Audience Segment"), true);
assert.equal(audienceThinListDiagnostic.scopeSummaryText, "Date Range • Channels • Audience Segment");
assert.equal(
    audienceThinListDiagnostic.semanticBindingFieldGroups[2].fields.some((field) => field.definitionRef === "harmonizer://feature/user.segment"),
    false,
);

assert.deepEqual(listDiagnostic, {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    detectedAt: 9200,
    reportRef: {
        reportId: "capacityQ3",
    },
    title: "Capacity Q3",
    subtitle: "Inventory Ladder",
    description: "Selected list entry metadata.",
    responseKind: "listReportDocumentsResponse",
    responseVersion: 1,
    documentKind: "",
    documentVersion: 4,
    documentSchemaVersion: 0,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    message: "This ReportDocument targets a different builder source: missing source kind, missing container, missing state key, missing data source.",
    suggestedAction: "Open this report from a compatible builder target or reload a matching report artifact.",
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
            description: "Approved reporting window for selected list entry diagnostics.",
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

const duplicateListDiagnosticResponse = {
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
const duplicatePublishedDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic(
    duplicateListDiagnosticResponse,
    {
        entryReportId: "capacityShared",
        entrySelectionKey: buildReportBuilderListReportDocumentsEntrySelectionKey(
            duplicateListDiagnosticResponse.entries[1],
        ),
        builderIdentity: {
            containerId: "demoReportBuilder",
            stateKey: "demoReportBuilder",
            dataSourceRef: "demoReportSource",
        },
        detectedAt: 9300,
    },
);
assert.equal(duplicatePublishedDiagnostic?.reportRef?.reportId, "capacityShared");
assert.equal(duplicatePublishedDiagnostic?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(duplicatePublishedDiagnostic?.source?.sourceArtifactId, "published_snapshot_capacity_shared");

const ambiguousSourceLessDuplicateDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic(
    {
        version: 1,
        kind: "listReportDocumentsResponse",
        entries: [
            {
                reportRef: { reportId: "capacityShared" },
                documentVersion: 9,
                title: "Capacity Shared",
            },
        ],
    },
    {
        entryReportId: "capacityShared",
        builderIdentity: {
            containerId: "demoReportBuilder",
            stateKey: "demoReportBuilder",
            dataSourceRef: "demoReportSource",
        },
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
        detectedAt: 9305,
    },
);
assert.equal(ambiguousSourceLessDuplicateDiagnostic?.localBackingAvailability, "ambiguous");
assert.equal(ambiguousSourceLessDuplicateDiagnostic?.localBackingLabel, "ambiguous local backing");

const conflictingTemplateListDiagnostic = buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "capacityQ3" },
            documentVersion: 4,
            title: "Capacity Q3",
            subtitle: "Inventory Ladder",
            description: "Selected list entry metadata.",
            templateId: "market_brief",
            templateLabel: "Market Brief",
            source: {},
        },
    ],
}, {
    entryReportId: "capacityQ3",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    localSavedPayloads: [
        {
            documentVersion: 4,
            savedAt: 8900,
            savedReportPayload: {
                version: 1,
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_capacity_q3_inventory_ladder",
                sourceArtifactId: "capacity_q3_inventory_ladder",
                reportDocument: {
                    version: 1,
                    kind: "reportDocument",
                    id: "capacityQ3",
                    title: "Capacity Q3",
                    templateId: "capacity_inventory_brief",
                    templateLabel: "Capacity Inventory Brief",
                },
            },
        },
    ],
    detectedAt: 9210,
});
assert.equal(conflictingTemplateListDiagnostic.templateConflict, true);
assert.equal(conflictingTemplateListDiagnostic.templateConflictLabel, "template mismatch");
assert.equal(conflictingTemplateListDiagnostic.templateLabel, "Market Brief");
assert.match(
    conflictingTemplateListDiagnostic.templateConflictMessage,
    /Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief\./,
);
assert.deepEqual(buildReportBuilderHydratedReportDocumentDiagnosticSummary(conflictingTemplateListDiagnostic), {
    title: "Capacity Q3",
    subtitle: "Inventory Ladder",
    description: "Selected list entry metadata.",
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportId: "capacityQ3",
    message: "This ReportDocument targets a different builder source: missing source kind, missing container, missing state key, missing data source.",
    templateId: "market_brief",
    templateLabel: "Market Brief",
    templateConflict: true,
    templateConflictLabel: "template mismatch",
    templateConflictMessage: "Catalog entry template Market Brief does not match the local backing report file template Capacity Inventory Brief.",
});

assert.equal(buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [
        {
            reportRef: { reportId: "demoReportBuilder" },
            documentVersion: 11,
            title: "Exploration Demo",
            source: {
                kind: "dashboard.reportBuilder",
                containerId: "demoReportBuilder",
                stateKey: "demoReportBuilder",
                dataSourceRef: "demoReportSource",
            },
        },
    ],
}, {
    entryReportId: "demoReportBuilder",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
}), null);

assert.deepEqual(buildReportBuilderListReportDocumentsEntryDiagnostic({
    version: 1,
    kind: "listReportDocumentsResponse",
    entries: [],
}, {
    entryReportId: "missingReport",
    builderIdentity: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    detectedAt: 9300,
}), {
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "missingEntry",
    severity: "error",
    detectedAt: 9300,
    reportRef: {
        reportId: "missingReport",
    },
    title: "missingReport",
    responseKind: "listReportDocumentsResponse",
    responseVersion: 1,
    documentKind: "",
    documentVersion: 0,
    documentSchemaVersion: 0,
    builderTarget: {
        containerId: "demoReportBuilder",
        stateKey: "demoReportBuilder",
        dataSourceRef: "demoReportSource",
    },
    message: "The list response entry missingReport is unavailable for reopen compatibility checks.",
    suggestedAction: "Select a valid catalog entry before checking reopen compatibility.",
});

assert.equal(buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, {
    code: "missingResponse",
    message: "A reopen bundle is required to reopen the builder.",
})?.code, "missingResponse");
const mergedReopenDiagnostic = mergeReportBuilderHydratedReportDocumentDiagnosticSharedArtifact({
    version: 1,
    kind: "reportBuilder.reopenDiagnostic",
    code: "incompatibleSource",
    severity: "error",
    reportRef: { reportId: "capacityShared" },
    title: "Capacity Shared Saved View",
    documentVersion: 8,
    source: {
        kind: "reportBuilder.savedView",
        reportId: "capacityShared",
        sourceArtifactId: "saved_view_capacity_shared",
    },
    message: "This ReportDocument targets a different builder source.",
}, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "capacityShared",
    title: "Capacity Shared Published Snapshot",
    documentVersion: 9,
    sourceArtifactId: "published_snapshot_capacity_shared",
});
assert.deepEqual(mergedReopenDiagnostic?.source, {
    kind: "reportBuilder.publishedSnapshot",
    reportId: "capacityShared",
    sourceArtifactId: "published_snapshot_capacity_shared",
});
assert.equal(mergedReopenDiagnostic?.title, "Capacity Shared Published Snapshot");
assert.equal(mergedReopenDiagnostic?.documentVersion, 9);
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticSummary({
    title: "   ",
    reportRef: { reportId: "demoReportBuilder" },
})?.title, "demoReportBuilder");

assert.equal(buildReportBuilderHydratedReportDocumentDiagnostic(getResponse, { valid: true }), null);
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticSummary(null), null);
assert.equal(serializeReportBuilderHydratedReportDocumentDiagnostic(null), "");
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticInspectorState(null), null);
assert.equal(buildReportBuilderHydratedReportDocumentDiagnosticDownload(null), null);

console.log("reportBuilderHydratedReportDocumentDiagnostic ✓ derives structured reopen diagnostics from hydration failures");
