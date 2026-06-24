import assert from "node:assert/strict";

import {
    buildReportBuilderSavedReportPayloadFromBuilderState,
} from "./reportBuilderSavedReportPayload.js";
import {
    buildReportBuilderGetReportDocumentResponse,
    buildReportBuilderGetReportDocumentResponseSummary,
    buildReportBuilderListReportDocumentsEntrySummary,
    buildReportBuilderListReportDocumentsResponse,
    buildReportBuilderSelectedGetReportDocumentResponse,
} from "./reportBuilderReportDocumentReadResponse.js";

const container = {
    id: "detailTargetReadResponseBuilder",
    stateKey: "detailTargetReadResponseBuilder",
    title: "Detail Target Read Response Builder",
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
    payloadId: "rbreport_detail_target_read_response",
    savedAt: 9900,
    title: "Detail Target Read Response Demo",
    sourceArtifactId: "detail_target_read_response_demo",
    reportDocument: {
        version: 1,
        kind: "reportDocument",
        id: "detailTargetReadResponseDemo",
        title: "Detail Target Read Response Demo",
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
    savedAt: 9950,
});

const getResponse = buildReportBuilderGetReportDocumentResponse(savedPayload, {
    documentVersion: 17,
    savedAt: 9960,
});
const listResponse = buildReportBuilderListReportDocumentsResponse(savedPayload, {
    documentVersion: 17,
    savedAt: 9960,
});

const getSummary = buildReportBuilderGetReportDocumentResponseSummary(getResponse);
assert.equal(getSummary.drillHierarchyCount, 1);
assert.equal(getSummary.detailTargetCount, 1);
assert.equal(getSummary.drillSummaryText, "1 drill hierarchy • 2 levels • 1 detail target • 1 field action");

const listEntrySummary = buildReportBuilderListReportDocumentsEntrySummary(listResponse.entries[0], {
    localSavedPayloads: [
        {
            documentVersion: 17,
            savedAt: 9960,
            savedReportPayload: savedPayload,
        },
    ],
});
assert.equal(listEntrySummary.drillHierarchyCount, 1);
assert.equal(listEntrySummary.detailTargetCount, 1);
assert.equal(listEntrySummary.drillSummaryText, "1 drill hierarchy • 2 levels • 1 detail target • 1 field action");

const selectedGetResponse = buildReportBuilderSelectedGetReportDocumentResponse(listResponse, savedPayload, {
    request: {
        reportRef: {
            reportId: "detailTargetReadResponseDemo",
        },
    },
    savedAt: 9970,
});

assert.equal(selectedGetResponse.reportRef.reportId, "detailTargetReadResponseDemo");
assert.deepEqual(selectedGetResponse.reportSpec.drillMetadata, {
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

console.log("reportBuilderDetailTargetReadResponsePersistence ✓ list/get/selected-get response helpers preserve authored detail-target mappings");
