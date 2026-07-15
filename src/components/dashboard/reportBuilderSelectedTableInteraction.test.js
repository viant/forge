import assert from "node:assert/strict";

import { buildReportBuilderSelectedTableInteractionState } from "./reportBuilderSelectedTableInteraction.js";

const interactionState = buildReportBuilderSelectedTableInteractionState({
    blockId: "primaryBuilder:tableView",
    row: {
        eventDate: "2026-06-25",
        channelId: 1,
        channel: { channel: "Display" },
        country: "US",
        totalSpend: 103253,
    },
    columns: [
        {
            key: "eventDate",
            sourceKey: "eventDate",
            displayKey: "eventDate",
            label: "Date",
            runtimeFilterable: true,
        },
        {
            key: "channelId",
            sourceKey: "channelId",
            displayKey: "channel.channel",
            label: "Channel",
            runtimeFilterable: true,
        },
        {
            key: "country",
            sourceKey: "country",
            displayKey: "country",
            label: "Market",
            runtimeFilterable: true,
        },
        {
            key: "totalSpend",
            sourceKey: "totalSpend",
            displayKey: "totalSpend",
            label: "Spend",
            runtimeFilterable: false,
        },
    ],
    drillMetadata: {
        hierarchies: [
            {
                id: "inventory_path",
                levels: [
                    { field: "eventDate", label: "Date" },
                    { field: "channelId", label: "Channel" },
                    { field: "country", label: "Market" },
                ],
            },
        ],
        fieldActions: [
            {
                fieldRef: "channelId",
                actions: [
                    { id: "keep_channel", label: "Keep only", kind: "keep" },
                    { id: "exclude_channel", label: "Exclude", kind: "exclude" },
                    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
                ],
            },
        ],
    },
});

assert.equal(interactionState.rowSummary, "Date: 2026-06-25 • Channel: Display • Market: US");
assert.deepEqual(interactionState.actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    label: action.label,
})), [
    { id: "keep:eventDate", kind: "keep", label: "Keep Date" },
    { id: "exclude:eventDate", kind: "exclude", label: "Exclude Date" },
    { id: "keep:country", kind: "keep", label: "Keep Market" },
    { id: "exclude:country", kind: "exclude", label: "Exclude Market" },
    { id: "drill:eventDate:inventory_path", kind: "drill", label: "Drill to Channel" },
    { id: "keep:channelId", kind: "keep", label: "Keep Channel" },
    { id: "exclude:channelId", kind: "exclude", label: "Exclude Channel" },
    { id: "drill:channelId:inventory_path", kind: "drill", label: "Drill to Market" },
    { id: "detail_channel", kind: "detail", label: "Show channel details" },
]);

assert.equal(buildReportBuilderSelectedTableInteractionState({
    blockId: "primaryBuilder:tableView",
    row: null,
    columns: [],
    drillMetadata: {},
}), null);

const duplicateDrillInteractionState = buildReportBuilderSelectedTableInteractionState({
    blockId: "primaryBuilder:tableView",
    row: {
        channelId: 1,
        channel: { channel: "Display" },
    },
    columns: [
        {
            key: "channelId",
            sourceKey: "channelId",
            displayKey: "channel.channel",
            label: "Channel",
            runtimeFilterable: true,
        },
    ],
    drillMetadata: {
        hierarchies: [
            {
                id: "performance_inventory",
                levels: [
                    { field: "channelId", label: "Channel" },
                    { field: "publisherId", label: "Publisher" },
                ],
            },
        ],
        fieldActions: [
            {
                fieldRef: "channelId",
                actions: [
                    { id: "keep_channel", label: "Keep only", kind: "keep" },
                    { id: "exclude_channel", label: "Exclude", kind: "exclude" },
                    { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
                    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
                ],
            },
        ],
    },
});

assert.deepEqual(duplicateDrillInteractionState.actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    label: action.label,
})), [
    { id: "keep:channelId", kind: "keep", label: "Keep Channel" },
    { id: "exclude:channelId", kind: "exclude", label: "Exclude Channel" },
    { id: "drill_publisher", kind: "drill", label: "Drill to Publisher" },
    { id: "detail_channel", kind: "detail", label: "Show channel details" },
]);

const liveProviderOverrideInteractionState = buildReportBuilderSelectedTableInteractionState({
    blockId: "primaryBuilder:tableView",
    row: {
        channelId: 1,
        channel: { channel: "Display" },
    },
    columns: [
        {
            key: "channelId",
            sourceKey: "channelId",
            displayKey: "channel.channel",
            label: "Channel",
            runtimeFilterable: true,
        },
    ],
    drillMetadata: {
        hierarchies: [
            {
                id: "performance_inventory",
                levels: [
                    { field: "channelId", label: "Channel" },
                    { field: "publisherId", label: "Publisher" },
                ],
            },
        ],
        fieldActions: [
            {
                fieldRef: "channelId",
                actions: [
                    { id: "keep_channel", label: "Keep only", kind: "keep" },
                    { id: "exclude_channel", label: "Exclude", kind: "exclude" },
                    { id: "drill_publisher", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
                    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://example/performance/channel-detail" },
                ],
            },
        ],
    },
    providerActionsByField: new Map([
        [
            "primaryBuilder:tableView:channelId",
            [
                { id: "keep_channel", label: "Keep only", kind: "keep" },
                { id: "exclude_channel", label: "Exclude", kind: "exclude" },
                { id: "semantic_drill_channel", label: "Drill to Publisher", kind: "drill", nextFieldRef: "publisherId" },
            ],
        ],
    ]),
});

assert.deepEqual(liveProviderOverrideInteractionState.actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    label: action.label,
})), [
    { id: "keep:channelId", kind: "keep", label: "Keep Channel" },
    { id: "exclude:channelId", kind: "exclude", label: "Exclude Channel" },
    { id: "semantic_drill_channel", kind: "drill", label: "Drill to Publisher" },
]);

console.log("reportBuilderSelectedTableInteraction ✓ builds selected-row summaries and runtime actions for the table leaf");
