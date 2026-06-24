import assert from "node:assert/strict";

import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
import {
    buildReportBuilderListReportDocumentsResponse,
    buildReportBuilderSelectedGetReportDocumentResponse,
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
    id: "detailTargetSelectedGetBuilder",
    stateKey: "detailTargetSelectedGetBuilder",
    title: "Detail Target Selected Get Builder",
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
    payloadId: "rbreport_detail_target_selected_get_reopen",
    savedAt: 10040,
    title: "Detail Target Selected Get Reopen Demo",
    sourceArtifactId: "detail_target_selected_get_reopen_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "detailTargetSelectedGetReopenDemo",
        title: "Detail Target Selected Get Reopen Demo",
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
    savedAt: 10050,
});

const listResponse = buildReportBuilderListReportDocumentsResponse(savedPayload, {
    documentVersion: 22,
    savedAt: 10060,
});

const selectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(
    listResponse,
    [{
        documentVersion: 22,
        savedAt: 10060,
        savedReportPayload: savedPayload,
    }],
    {
        request: {
            reportRef: {
                reportId: "detailTargetSelectedGetReopenDemo",
            },
        },
    },
);

const hydrated = buildHydratedReportBuilderDocument(selectedGetResponse, {
    container,
    builderIdentity: {
        containerId: container.id,
        stateKey: container.stateKey,
        dataSourceRef: container.dataSourceRef,
    },
});

assert.equal(hydrated.valid, true);
assert.deepEqual(hydrated.state.drillMetadata, {
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

const runtimeModel = buildReportBuilderRuntimePreviewModel({
    container,
    config: hydrated.config,
    state: hydrated.state,
});

const provider = resolveReportRuntimeDrillMetadataProvider({
    reportSpec: runtimeModel.reportSpec,
    runtimeHandlers: {},
});

assert.deepEqual(await provider.listAvailableRefinements("tableBlock", "channelV2"), [
    { id: "keep:channelV2", label: "Keep only", kind: "keep" },
    { id: "exclude:channelV2", label: "Exclude", kind: "exclude" },
    {
        id: "detail:channelV2:target:_example_performance_channel-detail-modal",
        label: "Show Channel details",
        kind: "detail",
        targetRef: "target://example/performance/channel-detail-modal",
    },
]);

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

console.log("reportBuilderDetailTargetSelectedGetReopenPersistence ✓ selected get response reopen preserves authored detail-target mappings into runtime preview");
