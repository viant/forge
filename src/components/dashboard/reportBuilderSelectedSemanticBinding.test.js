import assert from "node:assert/strict";

import { buildReportBuilderSelectedSemanticBindingViewState } from "./reportBuilderSelectedSemanticBinding.js";

const semanticSummary = {
    kind: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    modelLabel: "Ad Delivery",
    entity: "line_delivery",
    entityLabel: "Line Delivery",
    selectedDimensions: [
        { id: "event_date", rawId: "eventDate", label: "Delivery Date", category: "Time", definitionRef: "semantic://example/event_date" },
        { id: "channel", rawId: "channelId", label: "Channel", category: "Delivery", definitionRef: "semantic://example/channel" },
        { id: "country_code", rawId: "country", label: "Country", category: "Location", definitionRef: "semantic://example/country" },
    ],
    selectedMeasures: [
        { id: "spend", rawId: "totalSpend", label: "Spend", category: "Metrics", definitionRef: "semantic://example/spend" },
        { id: "impressions", rawId: "impressions", label: "Impressions", category: "Metrics", definitionRef: "semantic://example/impressions" },
    ],
    selectedParameters: [
        { id: "reporting_window", rawId: "dateRange", label: "Reporting Window", category: "Scope", definitionRef: "semantic://example/date_range" },
        { id: "channels_filter", rawId: "channelsFilter", label: "Channels", category: "Scope", definitionRef: "semantic://example/channels" },
    ],
};

const binding = {
    mode: "semantic",
    modelRef: "model://example/performance/delivery@v1",
    entity: "line_delivery",
    selectedDimensions: ["event_date", "channel", "country_code"],
    selectedMeasures: ["spend", "impressions"],
};

const chartState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "chartBlock",
    block: {
        kind: "chartBlock",
        chartSpec: {
            xField: "eventDate",
            seriesField: "channel.channel",
            yField: "totalSpend",
        },
    },
    semanticSummary,
    binding,
    chartFieldOptions: [
        { key: "eventDate", aliases: ["eventDate", "event_date"] },
        { key: "channel.channel", aliases: ["channelId", "channel"] },
        { key: "totalSpend", aliases: ["totalSpend", "spend"] },
    ],
});

assert.equal(chartState.semanticBindingTitle, "Semantic context");
assert.equal(chartState.chips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(chartState.chips.includes("Measures Spend"), true);
assert.equal(chartState.chips.includes("Parameters Reporting Window, Channels"), true);
assert.deepEqual(chartState.fieldGroups.map((group) => group.id), ["dimensions", "measures", "parameters"]);
assert.deepEqual(chartState.fieldGroups[0].fields.map((field) => field.label), ["Delivery Date", "Channel"]);
assert.deepEqual(chartState.fieldGroups[1].fields.map((field) => field.label), ["Spend"]);

const chartViewState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "chartView",
    block: {
        chartSpec: {
            xField: "eventDate",
            seriesField: "channel.channel",
            yField: "totalSpend",
        },
    },
    semanticSummary,
    binding,
    chartFieldOptions: [
        { key: "eventDate", aliases: ["eventDate", "event_date"] },
        { key: "channel.channel", aliases: ["channelId", "channel"] },
        { key: "totalSpend", aliases: ["totalSpend", "spend"] },
    ],
});

assert.equal(chartViewState.semanticBindingTitle, "Semantic context");
assert.equal(chartViewState.chips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(chartViewState.chips.includes("Measures Spend"), true);
assert.equal(chartViewState.chips.includes("Parameters Reporting Window, Channels"), true);

const filterBarState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "filterBarBlock",
    block: {
        kind: "filterBarBlock",
        paramIds: ["dateRange"],
    },
    semanticSummary,
    binding,
    tableFieldOptions: [
        { key: "country", kind: "dimension" },
        { key: "totalSpend", kind: "measure" },
    ],
});

assert.equal(filterBarState.semanticBindingTitle, "Semantic context");
assert.equal(filterBarState.chips.includes("Parameters Reporting Window"), true);
assert.equal(filterBarState.chips.some((chip) => chip.includes("Measures")), false);
assert.deepEqual(filterBarState.fieldGroups.map((group) => group.id), ["parameters"]);

const runtimeState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "refinementBarBlock",
    block: {
        kind: "refinementBarBlock",
    },
    semanticSummary,
    binding,
});

assert.equal(runtimeState.chips.includes("Dimensions Delivery Date, Channel +1"), true);
assert.equal(runtimeState.chips.includes("Measures Spend, Impressions"), true);

const badgesBlockState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "badgesBlock",
    block: {
        kind: "badgesBlock",
        items: [
            { label: "Country", valueField: "country" },
            { label: "Spend", valueField: "totalSpend" },
            { label: "Static", value: "ok" },
        ],
    },
    semanticSummary,
    binding,
});

assert.equal(badgesBlockState.semanticBindingTitle, "Semantic context");
assert.equal(badgesBlockState.chips.includes("Dimensions Country"), true);
assert.equal(badgesBlockState.chips.includes("Measures Spend"), true);
assert.equal(badgesBlockState.chips.includes("Parameters Reporting Window, Channels"), true);
assert.deepEqual(badgesBlockState.fieldGroups.map((group) => group.id), ["dimensions", "measures", "parameters"]);
assert.deepEqual(badgesBlockState.fieldGroups[0].fields.map((field) => field.label), ["Country"]);
assert.deepEqual(badgesBlockState.fieldGroups[1].fields.map((field) => field.label), ["Spend"]);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "tableBlock",
    block: {
        kind: "tableBlock",
        datasetRef: "regional_mix_csv",
        columns: [
            { key: "region", label: "Region" },
            { key: "revenue", label: "Revenue" },
        ],
    },
    semanticSummary,
    binding,
    tableFieldOptions: [
        { key: "region", kind: "dimension" },
        { key: "revenue", kind: "measure" },
    ],
}), null);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "chartBlock",
    block: {
        kind: "chartBlock",
        datasetRef: "regional_mix_csv",
        chartSpec: {
            xField: "region",
            yFields: ["revenue"],
        },
    },
    semanticSummary,
    binding,
    chartFieldOptions: [
        { key: "region", aliases: ["region"] },
        { key: "revenue", aliases: ["revenue"] },
    ],
}), null);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "kpiBlock",
    block: {
        kind: "kpiBlock",
        datasetRef: "regional_mix_csv",
        valueField: "revenue",
        secondaryField: "region",
    },
    semanticSummary,
    binding,
}), null);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "badgesBlock",
    block: {
        kind: "badgesBlock",
        datasetRef: "regional_mix_csv",
        items: [
            { label: "Status", valueField: "status" },
        ],
    },
    semanticSummary,
    binding,
    tableFieldOptions: [
        { key: "status", kind: "dimension" },
    ],
}), null);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "geoMapBlock",
    block: {
        kind: "geoMapBlock",
        datasetRef: "regional_mix_csv",
        geo: {
            key: "region",
            metric: {
                key: "revenue",
            },
        },
    },
    semanticSummary,
    binding,
}), null);

const drillHierarchyState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "drillHierarchy",
    block: {
        levels: [
            { field: "eventDate", label: "Delivery Date" },
            { field: "channelId", label: "Channel" },
        ],
    },
    semanticSummary,
    binding,
});

assert.equal(drillHierarchyState.semanticBindingTitle, "Semantic context");
assert.equal(drillHierarchyState.chips.includes("Dimensions Delivery Date, Channel"), true);
assert.equal(drillHierarchyState.chips.includes("Measures Spend, Impressions"), true);
assert.equal(drillHierarchyState.chips.includes("Parameters Reporting Window, Channels"), true);

const bindingOnlyChartViewState = buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "chartView",
    block: {
        chartSpec: {
            xField: "eventDate",
            yField: "totalSpend",
        },
    },
    semanticSummary: null,
    binding,
    chartFieldOptions: [
        { key: "eventDate", aliases: ["eventDate", "event_date"] },
        { key: "totalSpend", aliases: ["totalSpend", "spend"] },
    ],
});

assert.equal(bindingOnlyChartViewState.semanticBindingTitle, "Semantic context");
assert.equal(bindingOnlyChartViewState.chips.includes("Dimensions event_date, channel +1"), true);
assert.equal(bindingOnlyChartViewState.chips.includes("Measures spend, impressions"), true);

assert.equal(buildReportBuilderSelectedSemanticBindingViewState({
    entryKind: "markdownBlock",
    block: {
        kind: "markdownBlock",
    },
    semanticSummary,
    binding,
}), null);

console.log("reportBuilderSelectedSemanticBinding ✓ scopes semantic context by selected report outline leaf");
