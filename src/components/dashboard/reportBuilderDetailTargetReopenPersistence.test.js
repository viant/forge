import assert from "node:assert/strict";

import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
import {
    buildReportBuilderGetReportDocumentResponse,
} from "./reportBuilderReportDocumentReadResponse.js";
import {
    buildHydratedReportBuilderDocument,
} from "./reportBuilderHydratedReportDocument.js";
import {
    buildReportBuilderRuntimePreviewModel,
} from "./reportBuilderRuntimePreview.js";
import {
    resolveReportRuntimeDrillMetadataProvider,
} from "./reportRuntimeDrillProvider.js";

const container = {
    id: "detailTargetPersistenceBuilder",
    stateKey: "detailTargetPersistenceBuilder",
    title: "Detail Target Persistence Builder",
    dataSourceRef: "demoReportSource",
};

const config = {
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
};

const savedPayload = buildReportBuilderSavedReportPayloadFromBuilderState({
    version: 1,
    kind: "reportBuilder.savedReportPayload",
    payloadId: "rbreport_detail_target_persistence",
    savedAt: 9700,
    title: "Detail Target Persistence Demo",
    sourceArtifactId: "detail_target_persistence_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "detailTargetPersistenceDemo",
        title: "Detail Target Persistence Demo",
    },
    reportSpec: {
        version: 1,
        kind: "reportSpec",
        blocks: [{ id: "primaryTable" }],
        datasets: [{ id: "primary" }],
    },
}, {
    container,
    config,
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
            hierarchies: [
                {
                    id: "hierarchy:eventDate::channelV2",
                    label: "Date Drill",
                    levels: [
                        { field: "eventDate", label: "Event Date" },
                        { field: "channelV2", label: "Channel" },
                    ],
                },
            ],
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
    savedAt: 9800,
});

assert.deepEqual(savedPayload.reportSpec.drillMetadata, {
    hierarchies: [
        {
            id: "hierarchy:eventDate::channelV2",
            label: "Date Drill",
            levels: [
                { id: "eventDate", field: "eventDate", label: "Event Date" },
                { id: "channelV2", field: "channelV2", label: "Channel" },
            ],
        },
    ],
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
});

const getResponse = buildReportBuilderGetReportDocumentResponse(savedPayload, {
    documentVersion: 15,
    savedAt: 9850,
});

const hydrated = buildHydratedReportBuilderDocument(getResponse, {
    container,
    builderIdentity: {
        containerId: container.id,
        stateKey: container.stateKey,
        dataSourceRef: container.dataSourceRef,
    },
});

assert.equal(hydrated.valid, true);
assert.deepEqual(hydrated.state.drillMetadata, {
    hierarchies: [
        {
            id: "hierarchy:eventDate::channelV2",
            label: "Date Drill",
            levels: [
                { id: "eventDate", field: "eventDate", label: "Event Date" },
                { id: "channelV2", field: "channelV2", label: "Channel" },
            ],
        },
    ],
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
});

const model = buildReportBuilderRuntimePreviewModel({
    container,
    config: hydrated.config,
    state: hydrated.state,
});

const provider = resolveReportRuntimeDrillMetadataProvider({
    reportSpec: model.reportSpec,
    runtimeHandlers: {},
});

assert.deepEqual(await provider.getDetailTarget("target://example/performance/channel-detail-modal"), {
    targetRef: "target://example/performance/channel-detail-modal",
    navigationMode: "modal",
    title: "Archived Channel detail",
    description: "Open the archived channel detail route.",
    parameters: {
        channel: "$value",
        eventDate: "$row.eventDate",
        source: "archived",
    },
});

assert.deepEqual(await provider.listAvailableRefinements("tableBlock", "channelV2"), [
    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
    { id: "detail:channelV2:target:_example_performance_channel-detail-modal", label: "Show Channel details", kind: "detail", targetRef: "target://example/performance/channel-detail-modal" },
]);

console.log("reportBuilderDetailTargetReopenPersistence ✓ authored detail-target mappings survive save/get/reopen and feed runtime drill providers");
