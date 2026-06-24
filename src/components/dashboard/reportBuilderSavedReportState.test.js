import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildReportBuilderSavedReportState } from "./reportBuilderSavedReportState.js";

const audienceArtifactFixture = JSON.parse(
    readFileSync(
        new URL("../../reporting/fixtures/capacity-audience-artifact-fixture.v1.json", import.meta.url),
        "utf8",
    ),
);

const plainSavedPayload = {
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_capacity_q3",
    sourceArtifactId: "capacity_q3_inventory_ladder",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "capacityQ3",
        title: "Capacity Q3",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
};

const richSavedRecord = {
    documentVersion: 4,
    savedReportPayload: plainSavedPayload,
    exportRequest: {
        version: 1,
        kind: "reportExportRequest",
        target: { format: "pdf" },
        source: {
            from: "savedPayload",
            artifactKind: "reportBuilder.savedReportPayload",
            artifactRef: "reportBuilder.savedReportPayload://rbreport_capacity_q3",
            title: "Capacity Q3",
            payloadId: "rbreport_capacity_q3",
            sourceArtifactId: "capacity_q3_inventory_ladder",
            reportId: "capacityQ3",
            documentVersion: 4,
        },
        reportSpec: plainSavedPayload.reportSpec,
        reportFill: { version: 1, kind: "reportFill" },
        reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3" },
    },
};

const state = buildReportBuilderSavedReportState({
    savedReportPayload: plainSavedPayload,
    currentSavedRecord: richSavedRecord,
    configuredSavedPayloads: [richSavedRecord],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3",
        sourceArtifactId: "capacity_q3_inventory_ladder",
    },
    selectedListEntry: {
        reportRef: { reportId: "capacityQ3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_capacity_q3",
            sourceArtifactId: "capacity_q3_inventory_ladder",
        },
    },
});

assert.equal(state.rawLocalSavedPayloads.length, 3);
assert.equal(state.localSavedReportRecords.length, 3);
assert.equal(state.currentSavedRecord?.exportable, true);
assert.equal(state.reopenedSavedRecord?.exportable, true);
assert.equal(state.selectedListEntrySavedRecord?.exportable, true);
assert.equal(state.savedReportPayloadExportRequest?.source?.payloadId, "rbreport_capacity_q3");
assert.equal(state.reopenedExportRequest?.source?.payloadId, "rbreport_capacity_q3");
assert.equal(state.selectedListEntryExportRequest?.source?.payloadId, "rbreport_capacity_q3");
state.reopenedExportRequest.source.payloadId = "mutated";
assert.equal(richSavedRecord.exportRequest.source.payloadId, "rbreport_capacity_q3");

const plainOnlyState = buildReportBuilderSavedReportState({
    savedReportPayload: plainSavedPayload,
    configuredSavedPayloads: [],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "rbreport_capacity_q3",
    },
});

assert.equal(plainOnlyState.currentSavedRecord?.exportable, false);
assert.equal(plainOnlyState.savedReportPayloadExportRequest, null);
assert.equal(plainOnlyState.reopenedExportRequest, null);

const importedGetResponseBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredGetResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: {
                reportId: "capacityTrendImported",
            },
            savedAt: 9200,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 1,
                datasetCount: 1,
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacityTrendImported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
});

assert.equal(importedGetResponseBackedState.localSavedReportRecords.length, 1);
assert.equal(importedGetResponseBackedState.selectedListEntrySavedRecord?.reportId, "capacityTrendImported");
assert.equal(importedGetResponseBackedState.selectedListEntrySavedRecord?.documentVersion, 0);
assert.equal(importedGetResponseBackedState.selectedListEntrySavedRecord?.exportable, false);
assert.equal(importedGetResponseBackedState.selectedListEntryExportRequest, null);

const sourceLessImportedGetResponseBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredGetResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: {
                reportId: "capacityTrendImported",
            },
            savedAt: 9200,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityTrendImported",
                title: "Capacity Trend Imported",
            },
            compileState: {
                status: "clean",
                reportSpecVersion: 1,
                blockCount: 1,
                datasetCount: 1,
            },
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_imported_capacity_trend",
                sourceArtifactId: "imported_capacity_trend",
            },
        },
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacityTrendImported" },
    },
});
assert.equal(sourceLessImportedGetResponseBackedState.selectedListEntrySavedRecord?.reportId, "capacityTrendImported");
assert.equal(sourceLessImportedGetResponseBackedState.selectedListEntrySavedRecord?.documentVersion, 0);
assert.equal(sourceLessImportedGetResponseBackedState.selectedListEntryExportRequest, null);

const backendSharedArtifactState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "capacitySharedSavedView",
            title: "Capacity Shared Saved View",
            documentVersion: 8,
            savedAt: 9300,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacitySharedSavedView",
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
                reportId: "capacitySharedSavedView",
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
                    reportId: "capacitySharedSavedView",
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
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacitySharedSavedView" },
        source: {
            kind: "reportBuilder.savedView",
            reportId: "capacitySharedSavedView",
            sourceArtifactId: "saved_view_capacity_shared",
        },
    },
});

assert.equal(backendSharedArtifactState.localSavedReportRecords.length, 1);
assert.equal(backendSharedArtifactState.selectedListEntrySavedRecord?.reportId, "capacitySharedSavedView");
assert.equal(backendSharedArtifactState.selectedListEntrySavedRecord?.exportable, true);
assert.equal(
    backendSharedArtifactState.selectedListEntryExportRequest?.source?.sourceArtifactId,
    "saved_view_capacity_shared",
);

const ambiguousSourceLessSelectedEntryState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
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
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacityShared" },
    },
});
assert.equal(ambiguousSourceLessSelectedEntryState.selectedListEntrySavedRecord, null);
assert.equal(ambiguousSourceLessSelectedEntryState.selectedListEntryExportRequest, null);

const embeddedGetResponseBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredGetResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: {
                reportId: "embeddedBindingTrendQ3",
            },
            savedAt: 9210,
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
                                    description: "Embedded saved-state scope metadata.",
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
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_embedded_binding_trend",
                sourceArtifactId: "embedded_binding_trend",
            },
        },
    ],
    selectedListEntry: {
        reportRef: { reportId: "embeddedBindingTrendQ3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_embedded_binding_trend",
            sourceArtifactId: "embedded_binding_trend",
        },
    },
});
assert.equal(embeddedGetResponseBackedState.localSavedReportRecords.length, 1);
assert.equal(embeddedGetResponseBackedState.selectedListEntrySavedRecord?.document?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedGetResponseBackedState.selectedListEntrySavedRecord?.document?.semanticSummary?.selectedDimensions?.[1]?.label, "Channel");
assert.equal(embeddedGetResponseBackedState.selectedListEntrySavedRecord?.document?.scope?.params?.[0]?.label, "Reporting Window");
assert.equal(embeddedGetResponseBackedState.selectedListEntrySavedRecord?.reportSpec?.kind, "reportSpec");
assert.equal(embeddedGetResponseBackedState.selectedListEntrySavedRecord?.compileState?.reportSpecVersion, 1);

const embeddedEmptySpecGetResponseBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredGetResponses: [
        {
            version: 1,
            kind: "getReportDocumentResponse",
            reportRef: {
                reportId: "embeddedBindingTrendQ3",
            },
            savedAt: 9211,
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
                                    description: "Embedded saved-state scope metadata.",
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
            source: {
                kind: "reportBuilder.savedReportPayload",
                payloadId: "rbreport_embedded_binding_trend",
                sourceArtifactId: "embedded_binding_trend",
            },
        },
    ],
    selectedListEntry: {
        reportRef: { reportId: "embeddedBindingTrendQ3" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_embedded_binding_trend",
            sourceArtifactId: "embedded_binding_trend",
        },
    },
});
assert.equal(embeddedEmptySpecGetResponseBackedState.selectedListEntrySavedRecord?.document?.binding?.modelRef, "model://example/performance/delivery@v1");
assert.equal(embeddedEmptySpecGetResponseBackedState.selectedListEntrySavedRecord?.document?.semanticSummary?.selectedDimensions?.[1]?.label, "Channel");
assert.equal(embeddedEmptySpecGetResponseBackedState.selectedListEntrySavedRecord?.document?.scope?.params?.[0]?.label, "Reporting Window");
assert.equal(embeddedEmptySpecGetResponseBackedState.selectedListEntrySavedRecord?.reportSpec?.kind, "reportSpec");

const importedSavedRecordBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "capacityTrendImported",
            title: "Capacity Trend Imported",
            documentVersion: 9,
            savedAt: 9300,
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
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedPayload",
                    artifactKind: "reportBuilder.savedReportPayload",
                    artifactRef: "reportBuilder.savedReportPayload://rbreport_imported_capacity_trend",
                    title: "Capacity Trend Imported",
                    payloadId: "rbreport_imported_capacity_trend",
                    sourceArtifactId: "imported_capacity_trend",
                    reportId: "capacityTrendImported",
                    documentVersion: 9,
                },
                reportSpec: { version: 1, kind: "reportSpec" },
                reportFill: { version: 1, kind: "reportFill" },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Trend Imported" },
            },
        },
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacityTrendImported" },
        source: {
            kind: "reportBuilder.savedReportPayload",
            payloadId: "rbreport_imported_capacity_trend",
            sourceArtifactId: "imported_capacity_trend",
        },
    },
});

assert.equal(importedSavedRecordBackedState.selectedListEntrySavedRecord?.reportId, "capacityTrendImported");
assert.equal(importedSavedRecordBackedState.selectedListEntrySavedRecord?.exportable, true);
assert.equal(importedSavedRecordBackedState.selectedListEntryExportRequest?.source?.payloadId, "rbreport_imported_capacity_trend");
assert.equal(importedSavedRecordBackedState.selectedListEntryExportRequest?.source?.documentVersion, 9);

const sharedArtifactBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View",
            documentVersion: 8,
            savedAt: 9400,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "savedView",
                    artifactKind: "reportBuilder.savedView",
                    artifactRef: "reportBuilder.savedView://saved_view_capacity_q3",
                    sourceArtifactId: "saved_view_capacity_q3",
                    reportId: "capacityQ3",
                    documentVersion: 8,
                    title: "Capacity Q3 Saved View",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3 Saved View" },
            },
        },
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot",
            documentVersion: 9,
            savedAt: 9500,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3",
            },
            exportRequest: {
                version: 1,
                kind: "reportExportRequest",
                target: { format: "pdf" },
                source: {
                    from: "publishedSnapshot",
                    artifactKind: "reportBuilder.publishedSnapshot",
                    artifactRef: "reportBuilder.publishedSnapshot://published_snapshot_capacity_q3",
                    sourceArtifactId: "published_snapshot_capacity_q3",
                    reportId: "capacityQ3",
                    documentVersion: 9,
                    title: "Capacity Q3 Published Snapshot",
                },
                reportSpec: { version: 1, kind: "reportSpec", blocks: [{ id: "primaryTable" }], datasets: [{ id: "primary" }] },
                reportFill: { version: 1, kind: "reportFill", datasets: [{ id: "primary", rows: [] }] },
                reportPrint: { version: 1, kind: "reportPrint", title: "Capacity Q3 Published Snapshot" },
            },
        },
    ],
    reopenedSource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityQ3",
        sourceArtifactId: "saved_view_capacity_q3",
    },
    selectedListEntry: {
        reportRef: { reportId: "capacityQ3" },
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityQ3",
            sourceArtifactId: "published_snapshot_capacity_q3",
        },
    },
});

assert.equal(sharedArtifactBackedState.localSavedReportRecords.length, 2);
assert.equal(sharedArtifactBackedState.reopenedSavedRecord?.source?.kind, "reportBuilder.savedView");
assert.equal(sharedArtifactBackedState.reopenedExportRequest?.source?.from, "savedView");
assert.equal(sharedArtifactBackedState.selectedListEntrySavedRecord?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(sharedArtifactBackedState.selectedListEntryExportRequest?.source?.from, "publishedSnapshot");

const thinSharedArtifactBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Saved View Overlay",
            documentVersion: 10,
            savedAt: 9600,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Saved View Overlay",
            },
            source: {
                kind: "reportBuilder.savedView",
                reportId: "capacityQ3",
                sourceArtifactId: "saved_view_capacity_q3_overlay",
            },
        },
        {
            reportId: "capacityQ3",
            title: "Capacity Q3 Published Snapshot Overlay",
            documentVersion: 11,
            savedAt: 9700,
            document: {
                version: 1,
                kind: "reportDocument",
                id: "capacityQ3",
                title: "Capacity Q3 Published Snapshot Overlay",
            },
            source: {
                kind: "reportBuilder.publishedSnapshot",
                reportId: "capacityQ3",
                sourceArtifactId: "published_snapshot_capacity_q3_overlay",
            },
        },
    ],
    reopenedSource: {
        kind: "reportBuilder.savedView",
        reportId: "capacityQ3",
        sourceArtifactId: "saved_view_capacity_q3_overlay",
    },
    selectedListEntry: {
        reportRef: { reportId: "capacityQ3" },
        source: {
            kind: "reportBuilder.publishedSnapshot",
            reportId: "capacityQ3",
            sourceArtifactId: "published_snapshot_capacity_q3_overlay",
        },
    },
});

assert.equal(thinSharedArtifactBackedState.localSavedReportRecords.length, 2);
assert.equal(thinSharedArtifactBackedState.reopenedSavedRecord?.source?.kind, "reportBuilder.savedView");
assert.equal(thinSharedArtifactBackedState.reopenedSavedRecord?.exportable, false);
assert.equal(thinSharedArtifactBackedState.reopenedExportRequest, null);
assert.equal(thinSharedArtifactBackedState.selectedListEntrySavedRecord?.source?.kind, "reportBuilder.publishedSnapshot");
assert.equal(thinSharedArtifactBackedState.selectedListEntrySavedRecord?.exportable, false);
assert.equal(thinSharedArtifactBackedState.selectedListEntryExportRequest, null);

const fallbackReopenedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [richSavedRecord],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing_payload_id",
        sourceArtifactId: "missing_source_artifact",
    },
    reopenedReportId: "capacityQ3",
});

assert.equal(fallbackReopenedState.reopenedSavedRecord?.reportId, "capacityQ3");
assert.equal(fallbackReopenedState.reopenedSavedRecord?.exportable, true);
assert.equal(fallbackReopenedState.reopenedExportRequest?.source?.payloadId, "rbreport_capacity_q3");

const emptyFallbackState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredSavedPayloads: [
        {
            reportId: "",
            title: "Empty Report Id",
            documentVersion: 1,
            savedAt: 1,
            document: { version: 1, kind: "reportDocument", id: "ignored" },
            source: { kind: "reportBuilder.savedReportPayload", payloadId: "ignored" },
            exportRequest: richSavedRecord.exportRequest,
        },
    ],
    reopenedSource: {
        kind: "reportBuilder.savedReportPayload",
        payloadId: "missing_payload_id",
    },
    reopenedReportId: "",
});

assert.equal(emptyFallbackState.reopenedSavedRecord, null);
assert.equal(emptyFallbackState.reopenedExportRequest, null);

const audienceGetResponseBackedState = buildReportBuilderSavedReportState({
    savedReportPayload: null,
    configuredGetResponses: [
        audienceArtifactFixture.getReportDocumentResponse,
    ],
    selectedListEntry: {
        reportRef: { reportId: "capacityAudienceSegmentIndexQ3" },
        source: audienceArtifactFixture.getReportDocumentResponse.source,
    },
});

assert.equal(audienceGetResponseBackedState.localSavedReportRecords.length, 1);
assert.equal(
    audienceGetResponseBackedState.selectedListEntrySavedRecord?.document?.semanticSummary?.selectedMeasures?.[0]?.definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(
    audienceGetResponseBackedState.selectedListEntrySavedRecord?.document?.semanticSummary?.selectedParameters?.[1]?.definitionRef,
    "harmonizer://feature/user.segment",
);
assert.equal(
    audienceGetResponseBackedState.selectedListEntrySavedRecord?.document?.scope?.params?.[2]?.id,
    "audienceSegmentFilter",
);
assert.equal(
    audienceGetResponseBackedState.selectedListEntrySavedRecord?.reportSpec?.semanticSummary?.selectedMeasures?.[0]?.definitionRef,
    "harmonizer://feature/user.segment.index",
);
assert.equal(audienceGetResponseBackedState.selectedListEntryExportRequest, null);

console.log("reportBuilderSavedReportState ✓ centralizes local saved record normalization and export availability resolution");
