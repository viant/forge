import assert from "node:assert/strict";

import {
    summarizeReportBuilderAuthoredBlock,
    summarizeReportBuilderAuthoredBlocks,
    summarizeReportBuilderAuthoredDrillMetadata,
} from "./reportBuilderAuthoredBlockSummary.js";

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "narrative",
    kind: "markdownBlock",
    title: "Narrative",
    markdown: "## Narrative\nA short reader-facing setup.",
}), {
    id: "narrative",
    kind: "markdownBlock",
    title: "Narrative",
    summary: "A short reader-facing setup.",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Delivery Comparison",
    columns: [
        { key: "eventDate", label: "Date" },
        { key: "channelV2", label: "Channel" },
        { key: "avails", label: "Avails" },
        { key: "hhUniqs", label: "HH Uniques" },
    ],
}), {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Delivery Comparison",
    columnCount: 4,
    columns: ["Date", "Channel", "Avails", "HH Uniques"],
    summary: "4 columns: Date, Channel, Avails, +1 more",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "inventoryChart",
    kind: "chartBlock",
    title: "Inventory by Channel",
    chartSpec: {
        type: "horizontal_bar",
        xField: "channelV2",
        yFields: ["avails", "hhUniqs"],
        seriesField: "country",
    },
}), {
    id: "inventoryChart",
    kind: "chartBlock",
    title: "Inventory by Channel",
    chartType: "horizontal_bar",
    xField: "channelV2",
    yFields: ["avails", "hhUniqs"],
    seriesField: "country",
    summary: "Horizontal Bar chart by channelV2 using avails, hhUniqs split by country",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "headlineKpi",
    kind: "kpiBlock",
    title: "Headline KPI",
    valueLabel: "Available Impressions",
    secondaryLabel: "Channel",
    description: "First-row KPI snapshot",
}), {
    id: "headlineKpi",
    kind: "kpiBlock",
    title: "Headline KPI",
    valueLabel: "Available Impressions",
    secondaryLabel: "Channel",
    description: "First-row KPI snapshot",
    summary: "Available Impressions with Channel context (First-row KPI snapshot)",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "geoMap",
    kind: "geoMapBlock",
    title: "Market Coverage",
    geo: {
        shape: "us-states",
        key: "country",
        metric: {
            key: "avails",
            label: "Avails",
        },
        aggregate: "sum",
    },
}), {
    id: "geoMap",
    kind: "geoMapBlock",
    title: "Market Coverage",
    shape: "us-states",
    key: "country",
    metricLabel: "Avails",
    aggregate: "sum",
    summary: "Us States map by country using Avails (sum)",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "sharedFilters",
    kind: "filterBarBlock",
    title: "Report Scope",
    paramIds: ["dateRange", "channelsFilter", "audienceSegmentFilter"],
}, {
    scopeParamOptions: [
        { value: "dateRange", label: "Date Range" },
        { value: "channelsFilter", label: "Channels" },
        { value: "audienceSegmentFilter", label: "Audience Segment" },
    ],
}), {
    id: "sharedFilters",
    kind: "filterBarBlock",
    title: "Report Scope",
    paramCount: 3,
    paramIds: ["dateRange", "channelsFilter", "audienceSegmentFilter"],
    paramLabels: ["Date Range", "Channels", "Audience Segment"],
    summary: "3 shared scope parameters: Date Range, Channels, Audience Segment",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlock({
    id: "activeRefinements",
    kind: "refinementBarBlock",
    title: "Active Refinements",
    actionKinds: ["remove", "clearAll"],
}), {
    id: "activeRefinements",
    kind: "refinementBarBlock",
    title: "Active Refinements",
    actionKinds: ["remove", "clearAll"],
    actionCount: 2,
    summary: "2 refinement actions: Remove, Clear All",
});

assert.deepEqual(summarizeReportBuilderAuthoredBlocks([
    {
        id: "narrative",
        kind: "markdownBlock",
        title: "Narrative",
        markdown: "## Narrative\nA short reader-facing setup.",
    },
    {
        id: "sharedFilters",
        kind: "filterBarBlock",
        title: "Report Scope",
        paramIds: ["dateRange"],
    },
    {
        id: "comparisonTable",
        kind: "tableBlock",
        title: "Delivery Comparison",
        columns: [
            { key: "eventDate", label: "Date" },
            { key: "avails", label: "Avails" },
        ],
    },
]), {
    totalCount: 3,
    countsByKind: {
        markdownBlock: 1,
        filterBarBlock: 1,
        tableBlock: 1,
    },
    items: [
        {
            id: "narrative",
            kind: "markdownBlock",
            title: "Narrative",
            summary: "A short reader-facing setup.",
        },
        {
            id: "sharedFilters",
            kind: "filterBarBlock",
            title: "Report Scope",
            paramCount: 1,
            paramIds: ["dateRange"],
            paramLabels: ["dateRange"],
            summary: "1 shared scope parameter: dateRange",
        },
        {
            id: "comparisonTable",
            kind: "tableBlock",
            title: "Delivery Comparison",
            columnCount: 2,
            columns: ["Date", "Avails"],
            summary: "2 columns: Date, Avails",
        },
    ],
    summary: "3 authored blocks: 1 Filter Bar, 1 Markdown, 1 Table",
});

assert.deepEqual(summarizeReportBuilderAuthoredDrillMetadata({
    drillMetadata: {
        hierarchies: [
            {
                id: "inventory",
                label: "Inventory Ladder",
                levels: [
                    { field: "channelV2", label: "Channel" },
                    { field: "publisher", label: "Publisher" },
                    { field: "siteType", label: "Site Type" },
                ],
            },
            {
                id: "location",
                levels: [
                    { field: "country", label: "Market" },
                    { field: "region", label: "Region" },
                ],
            },
        ],
        fieldActions: [
            {
                fieldRef: "channelV2",
                actions: [
                    { id: "drill_market", label: "Drill to Market", kind: "drill", nextFieldRef: "country" },
                    { id: "detail_channel", label: "Show channel details", kind: "detail", targetRef: "target://channel" },
                ],
            },
            {
                fieldRef: "country",
                actions: [
                    { id: "detail_market", label: "Show market details", kind: "detail", targetRef: "target://market" },
                ],
            },
        ],
        detailTargets: [
            {
                targetRef: "target://channel",
                title: "Channel detail",
                navigationMode: "hostRoute",
                parameters: {
                    channel: "$value",
                    campaign: "$row.campaign",
                },
            },
            {
                targetRef: "target://market",
                navigationMode: "hostRoute",
                parameters: {
                    country: "$value",
                },
            },
        ],
    },
}), {
    hierarchyCount: 2,
    hierarchyLevelCount: 5,
    detailTargetCount: 2,
    detailTargetParameterCount: 3,
    fieldActionCount: 3,
    hierarchies: [
        {
            id: "inventory",
            label: "Inventory Ladder",
            levelCount: 3,
            levels: ["Channel", "Publisher", "Site Type"],
            summary: "3 levels: Channel -> Publisher -> Site Type",
        },
        {
            id: "location",
            label: "location",
            levelCount: 2,
            levels: ["Market", "Region"],
            summary: "2 levels: Market -> Region",
        },
    ],
    detailTargets: [
        {
            targetRef: "target://channel",
            label: "Channel detail",
            navigationMode: "hostRoute",
            parameterCount: 2,
            parameters: ["channel", "campaign"],
            summary: "2 parameters: channel, campaign",
        },
        {
            targetRef: "target://market",
            label: "target://market",
            navigationMode: "hostRoute",
            parameterCount: 1,
            parameters: ["country"],
            summary: "1 parameter: country",
        },
    ],
    summary: "2 drill hierarchies • 5 levels • 2 detail targets • 3 field actions",
});

console.log("reportBuilderAuthoredBlockSummary ✓ summarizes authored blocks and drill metadata for reader-facing inspector surfaces");
