import assert from "node:assert/strict";

import {
    buildReportBuilderDatasetOptions,
    buildReportBuilderScopeParamSummary,
    buildReportBuilderScopeSummaryFromParams,
    buildReportBuilderDocumentCompileValidation,
    buildReportBuilderDocumentBlockFieldOptions,
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderDocumentBlockDiagnostics,
    buildReportBuilderDocumentBlockDraft,
    duplicateReportBuilderDocumentBlockState,
    moveReportBuilderDocumentBlockRelativeState,
    moveReportBuilderDocumentBlockState,
    normalizeReportBuilderDocumentLayoutState,
    removeReportBuilderDocumentBlockState,
    parseReportBuilderBadgeRuleRows,
    resizeReportBuilderDocumentBlockState,
    resolveReportBuilderBadgeRuleRows,
    resolveReportBuilderDocumentWidthLabels,
    resolveReportBuilderDocumentBlockList,
    serializeReportBuilderBadgeRuleRows,
    summarizeReportBuilderDocumentMarkdown,
    upsertReportBuilderDocumentBlockState,
    validateReportBuilderDocumentBlockDraft,
    rebindReportBuilderDocumentBlockDraft,
} from "./reportBuilderDocumentBlocks.js";

const markdownDraft = buildReportBuilderDocumentBlockDraft("markdownBlock");
assert.equal(markdownDraft.kind, "markdownBlock");
assert.equal(markdownDraft.title, "Narrative");
assert.equal(markdownDraft.markdown, "");
assert.equal(
    summarizeReportBuilderDocumentMarkdown("## Narrative\nAdd report context."),
    "Add report context.",
);
assert.equal(
    summarizeReportBuilderDocumentMarkdown("## Narrative"),
    "Narrative",
);
assert.equal(
    summarizeReportBuilderDocumentMarkdown("## Narrative\n---\nAdd report context."),
    "Add report context.",
);
assert.equal(
    summarizeReportBuilderDocumentMarkdown("## Narrative\n```\nconst value = 1;\n```\nExplain the value."),
    "Explain the value.",
);
assert.equal(
    summarizeReportBuilderDocumentMarkdown(""),
    "Narrative block",
);
assert.deepEqual(resolveReportBuilderDocumentWidthLabels(""), {
    span: 12,
    nextSpan: 8,
    isHalfWidth: false,
    currentLabel: "Width: Full",
    actionLabel: "Make 2/3",
    actionTitle: "Resize block to 2/3 width",
    actionIcon: "minimize",
});
assert.deepEqual(resolveReportBuilderDocumentWidthLabels("half"), {
    span: 6,
    nextSpan: 4,
    isHalfWidth: true,
    currentLabel: "Width: 1/2",
    actionLabel: "Make 1/3",
    actionTitle: "Resize block to 1/3 width",
    actionIcon: "minimize",
});

const filterBarDraft = buildReportBuilderDocumentBlockDraft("filterBarBlock", null, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
});
assert.deepEqual(filterBarDraft, {
    kind: "filterBarBlock",
    id: "filterBar",
    title: "Filters",
    datasetRef: "primary",
    paramIds: ["dateRange"],
});

const scopedFilterBarDraft = buildReportBuilderDocumentBlockDraft("filterBarBlock", {
    datasetRef: "forecast_cube",
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
    datasetOptions: [
        {
            value: "primary",
            scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
        },
        {
            value: "forecast_cube",
            scopeParamOptions: [{ value: "region", label: "Region", kind: "multiSelect" }],
        },
    ],
});
assert.deepEqual(scopedFilterBarDraft, {
    kind: "filterBarBlock",
    id: "filterBar",
    title: "Filters",
    datasetRef: "forecast_cube",
    paramIds: ["region"],
});

const unscopedDatasetFilterBarDraft = buildReportBuilderDocumentBlockDraft("filterBarBlock", {
    datasetRef: "forecast_cube",
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
    datasetOptions: [
        {
            value: "primary",
            scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
        },
        {
            value: "forecast_cube",
            scopeParamOptions: [],
        },
    ],
});
assert.deepEqual(unscopedDatasetFilterBarDraft, {
    kind: "filterBarBlock",
    id: "filterBar",
    title: "Filters",
    datasetRef: "forecast_cube",
    paramIds: [],
});

const multiDatasetDefaultTableDraft = buildReportBuilderDocumentBlockDraft("tableBlock", null, {
    datasetOptions: [
        { value: "primary" },
        { value: "segment_status_csv" },
    ],
    tableColumnOptions: [
        { key: "eventDate", label: "Event Date", kind: "dimension", selected: true },
        { key: "avails", label: "Avails", kind: "measure", selected: true },
    ],
});
assert.equal(multiDatasetDefaultTableDraft.datasetRef, "primary");

const staticDatasetTableDraft = buildReportBuilderDocumentBlockDraft("tableBlock", {
    datasetRef: "regional_mix_csv",
}, {
    datasetOptions: [
        { value: "primary" },
        {
            value: "regional_mix_csv",
            columnOptions: [
                { key: "region", label: "Region", kind: "dimension" },
                { key: "forecastRevenue", label: "ForecastRevenue", kind: "measure" },
                { key: "share", label: "Share", kind: "measure" },
            ],
        },
    ],
    tableColumnOptions: [
        { key: "eventDate", label: "Event Date", kind: "dimension", selected: true },
        { key: "avails", label: "Avails", kind: "measure", selected: true },
    ],
});
assert.equal(staticDatasetTableDraft.datasetRef, "regional_mix_csv");
assert.deepEqual(staticDatasetTableDraft.columnKeys, ["region", "forecastRevenue", "share"]);
assert.deepEqual(staticDatasetTableDraft.columns.map((column) => column.key), ["region", "forecastRevenue", "share"]);

assert.deepEqual(buildReportBuilderScopeParamSummary(["dateRange", "channelsFilter"], [
    { value: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview.", kind: "dateRange", required: true },
    { value: "channelsFilter", label: "Channels", description: "Approved channel scope for the authored report.", kind: "multiSelect", required: false },
]), {
    items: [
        { id: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview." },
        { id: "channelsFilter", label: "Channels", description: "Approved channel scope for the authored report." },
    ],
    text: "Date Range • Channels",
});

assert.deepEqual(buildReportBuilderScopeParamSummary([], [
    { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
]), {
    items: [],
    text: "No report filters",
});

assert.deepEqual(buildReportBuilderScopeSummaryFromParams([
    {
        id: "dateRange",
        label: "Date Range",
        description: "Approved reporting window for semantic preview.",
    },
    {
        id: "channelsFilter",
        label: "Channels",
    },
]), {
    items: [
        { id: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview." },
        { id: "channelsFilter", label: "Channels" },
    ],
    text: "Date Range • Channels",
});

const refinementBarDraft = buildReportBuilderDocumentBlockDraft("refinementBarBlock");
assert.deepEqual(refinementBarDraft, {
    kind: "refinementBarBlock",
    id: "refinementTrail",
    title: "Active Refinements",
    actionKinds: ["remove", "clearAll"],
    emptyLabel: "No active refinements",
});

const chartBlockDraft = buildReportBuilderDocumentBlockDraft("chartBlock", null, {
    chartConfig: {
        measures: [{ id: "avails", key: "avails", label: "Avails" }],
        dimensions: [{ id: "eventDate", key: "eventDate", label: "Event Date", chartAxis: true }],
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartState: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
    },
});
assert.deepEqual(chartBlockDraft, {
    kind: "chartBlock",
    id: "chartBlock",
    title: "Chart",
    datasetRef: "primary",
    chartSpec: {
        title: "Chart",
        type: "line",
        xField: "eventDate",
        yFields: ["avails"],
    },
});

const chartBlockDatasetDefaultDraft = buildReportBuilderDocumentBlockDraft("chartBlock", null, {
    datasetOptions: [
        { value: "primary", scopeParamOptions: [] },
        { value: "reach_summary", scopeParamOptions: [] },
    ],
    chartConfig: {
        measures: [{ id: "avails", key: "avails", label: "Avails" }],
        dimensions: [{ id: "eventDate", key: "eventDate", label: "Event Date", chartAxis: true }],
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartState: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
    },
});
assert.equal(chartBlockDatasetDefaultDraft.datasetRef, "primary");

const chartBlockStaticDatasetDraft = buildReportBuilderDocumentBlockDraft("chartBlock", {
    datasetRef: "regional_mix_csv",
}, {
    datasetOptions: [
        { value: "primary", scopeParamOptions: [] },
        {
            value: "regional_mix_csv",
            chartFieldOptions: [
                { key: "region", label: "Region", kind: "dimension" },
                { key: "forecastRevenue", label: "Forecast Revenue", kind: "measure" },
                { key: "share", label: "Share", kind: "measure" },
            ],
        },
    ],
    chartConfig: {
        measures: [{ id: "avails", key: "avails", label: "Avails" }],
        dimensions: [{ id: "eventDate", key: "eventDate", label: "Event Date", chartAxis: true }],
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartState: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["eventDate"],
    },
});
assert.deepEqual(chartBlockStaticDatasetDraft, {
    kind: "chartBlock",
    id: "chartBlock",
    title: "Chart",
    datasetRef: "regional_mix_csv",
    chartSpec: {
        title: "Chart",
        type: "bar",
        xField: "region",
        yFields: ["forecastRevenue"],
    },
});

assert.deepEqual(buildReportBuilderDatasetOptions({
    currentSourceRef: "demoReportSource",
    configuredSources: [
        {
            id: "reach_summary",
            dataSourceRef: "reachSummarySource",
            label: "Reach Summary",
            kindLabel: "published",
            dimensions: [
                { id: "country", key: "country", label: "Country", default: true },
            ],
            measures: [
                { id: "avails", key: "avails", label: "Avails", format: "compactNumber", default: true },
            ],
            source: {
                kind: "mcp",
                toolName: "demo:reach_summary",
            },
            request: {
                filters: {
                    country: ["US"],
                },
            },
            resultContract: {
                shape: "rowSet",
                rowPath: "payload.records",
            },
            capabilities: {
                backendRefetch: true,
            },
            scope: {
                inheritContext: true,
            },
            scopeParamOptions: [{ value: "reachCountry", label: "Reach Country" }],
        },
    ],
    staticDatasets: [],
    tableColumnOptions: [{ key: "country", label: "Country", kind: "dimension" }],
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
    secondaryFieldOptions: [{ value: "country", label: "Country" }],
    chartFieldOptions: [{ key: "avails", label: "Avails", kind: "measure" }],
    scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
}), [
    {
        value: "primary",
        dataSourceRef: "demoReportSource",
        label: "demoReportSource",
        description: "",
        kindLabel: "published",
        columnOptions: [{ key: "country", label: "Country", kind: "dimension" }],
        valueFieldOptions: [{ value: "avails", label: "Avails" }],
        secondaryFieldOptions: [{ value: "country", label: "Country" }],
        chartFieldOptions: [{ key: "avails", label: "Avails", kind: "measure" }],
        scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
    },
    {
        value: "reach_summary",
        dataSourceRef: "reachSummarySource",
        label: "Reach Summary",
        description: "",
        kindLabel: "published",
        request: {
            filters: {
                country: ["US"],
            },
        },
        source: {
            kind: "mcp",
            toolName: "demo:reach_summary",
        },
        resultContract: {
            shape: "rowSet",
            rowPath: "payload.records",
        },
        capabilities: {
            backendRefetch: true,
        },
        scope: {
            inheritContext: true,
        },
        columnOptions: [
            { key: "country", label: "Country", kind: "dimension", sourceKey: "country", default: true },
            { key: "avails", label: "Avails", kind: "measure", sourceKey: "avails", format: "compactNumber", default: true },
        ],
        valueFieldOptions: [
            { value: "avails", label: "Avails", format: "compactNumber", default: true },
        ],
        secondaryFieldOptions: [
            { value: "country", label: "Country", default: true },
        ],
        chartFieldOptions: [
            { key: "country", aliases: ["country"], label: "Country", kind: "dimension", default: true },
            { key: "avails", aliases: ["avails"], label: "Avails", kind: "measure", format: "compactNumber", default: true },
        ],
        scopeParamOptions: [{ value: "reachCountry", label: "Reach Country" }],
    },
]);

const fieldOptionsWithDatasets = buildReportBuilderDocumentBlockFieldOptions({
    config: {
        dataSourceRef: "demoReportSource",
        measures: [{ id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" }],
        dimensions: [{ id: "country", key: "country", label: "Country", default: true }],
        staticFilters: [{ id: "dateRange", type: "dateRange", required: true }],
        result: { defaultMode: "table" },
        datasets: [
            {
                id: "reach_summary",
                dataSourceRef: "reachSummarySource",
                label: "Reach Summary",
                kindLabel: "published",
                scopeParamOptions: [{ value: "reachCountry", label: "Reach Country" }],
            },
        ],
    },
    state: {
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
        selectedDimensions: ["country"],
    },
    currentSourceRef: "demoReportSource",
});
assert.equal(Array.isArray(fieldOptionsWithDatasets.datasetOptions), true);
assert.equal(fieldOptionsWithDatasets.datasetOptions.some((option) => option.value === "primary"), true);
assert.equal(fieldOptionsWithDatasets.datasetOptions.some((option) => option.value === "reach_summary"), true);

const fieldOptionsWithDocumentDatasetCatalog = buildReportBuilderDocumentBlockFieldOptions({
    document: {
        version: 1,
        kind: "reportDocument",
        datasets: [
            {
                id: "primary",
                dataSourceRef: "demoReportSource",
                label: "Primary",
                kindLabel: "primary",
                columnOptions: [
                    { key: "country", label: "Country", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
                ],
                valueFieldOptions: [{ value: "avails", label: "Avails", format: "compactNumber" }],
                secondaryFieldOptions: [{ value: "country", label: "Country" }],
                chartFieldOptions: [
                    { key: "country", label: "Country", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
                ],
                scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
            },
            {
                id: "reach_summary",
                dataSourceRef: "reachSummarySource",
                label: "Reach Summary",
                kindLabel: "published",
                scopeParamOptions: [{ value: "reachCountry", label: "Reach Country" }],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    dataSourceRef: "demoReportSource",
                },
                config: {
                    dataSourceRef: "demoReportSource",
                    measures: [{ id: "avails", key: "avails", label: "Avails", default: true, format: "compactNumber" }],
                    dimensions: [{ id: "country", key: "country", label: "Country", default: true }],
                    staticFilters: [{ id: "dateRange", type: "dateRange", required: true }],
                    result: { defaultMode: "table" },
                },
                state: {
                    selectedMeasures: ["avails"],
                    primaryMeasure: "avails",
                    selectedDimensions: ["country"],
                },
            },
        ],
    },
});
assert.equal(fieldOptionsWithDocumentDatasetCatalog.datasetOptions.some((option) => option.value === "reach_summary"), true);

const fieldOptionsWithPrimaryDocumentDatasetFallback = buildReportBuilderDocumentBlockFieldOptions({
    document: {
        version: 1,
        kind: "reportDocument",
        binding: {
            mode: "semantic",
            modelRef: "model://example/performance/delivery@v1",
            entity: "line_delivery",
        },
        datasets: [
            {
                id: "primary",
                dataSourceRef: "demoReportSource",
                label: "Primary",
                kindLabel: "primary",
                columnOptions: [
                    { key: "country", label: "Country", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
                ],
                valueFieldOptions: [{ value: "avails", label: "Avails", format: "compactNumber" }],
                secondaryFieldOptions: [{ value: "country", label: "Country" }],
                chartFieldOptions: [
                    { key: "country", label: "Country", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
                ],
                scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
            },
            {
                id: "reach_summary",
                dataSourceRef: "reachSummarySource",
                label: "Reach Summary",
                kindLabel: "published",
                scopeParamOptions: [{ value: "reachCountry", label: "Reach Country" }],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    dataSourceRef: "demoReportSource",
                },
                state: {
                    selectedMeasures: ["avails"],
                    primaryMeasure: "avails",
                    selectedDimensions: ["country"],
                },
            },
        ],
    },
});
assert.deepEqual(fieldOptionsWithPrimaryDocumentDatasetFallback.valueFieldOptions, [
    { value: "avails", label: "Avails", format: "compactNumber" },
]);
assert.deepEqual(fieldOptionsWithPrimaryDocumentDatasetFallback.secondaryFieldOptions, [
    { value: "country", label: "Country" },
]);
assert.equal(fieldOptionsWithPrimaryDocumentDatasetFallback.datasetOptions.some((option) => option.value === "primary"), true);
assert.equal(fieldOptionsWithPrimaryDocumentDatasetFallback.datasetOptions.some((option) => option.value === "reach_summary"), true);

const geoMapDraft = buildReportBuilderDocumentBlockDraft("geoMapBlock", null, {
    tableColumnOptions: [
        { key: "country", label: "Country", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
    ],
});
assert.deepEqual(geoMapDraft, {
    kind: "geoMapBlock",
    id: "geoMapBlock",
    title: "Geo Map",
    datasetRef: "primary",
    geo: {
        shape: "us-states",
        key: "country",
        metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
        },
        aggregate: "sum",
    },
});

const kpiDatasetDefaultDraft = buildReportBuilderDocumentBlockDraft("kpiBlock", null, {
    datasetOptions: [
        { value: "primary", scopeParamOptions: [] },
        { value: "reach_summary", scopeParamOptions: [] },
    ],
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
    secondaryFieldOptions: [{ value: "country", label: "Country" }],
});
assert.equal(kpiDatasetDefaultDraft.datasetRef, "primary");

const kpiStaticDatasetDraft = buildReportBuilderDocumentBlockDraft("kpiBlock", {
    datasetRef: "regional_mix_csv",
}, {
    datasetOptions: [
        { value: "primary", scopeParamOptions: [] },
        {
            value: "regional_mix_csv",
            valueFieldOptions: [
                { value: "forecastRevenue", label: "ForecastRevenue" },
                { value: "share", label: "Share" },
            ],
            secondaryFieldOptions: [
                { value: "region", label: "Region" },
            ],
        },
    ],
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
    secondaryFieldOptions: [{ value: "country", label: "Country" }],
});
assert.deepEqual(kpiStaticDatasetDraft, {
    kind: "kpiBlock",
    id: "kpiBlock",
    title: "Headline KPI",
    datasetRef: "regional_mix_csv",
    valueField: "forecastRevenue",
    valueLabel: "ForecastRevenue",
    secondaryField: "",
    secondaryLabel: "",
    description: "",
    emptyLabel: "No KPI value available.",
});

const kpiDraft = buildReportBuilderDocumentBlockDraft("kpiBlock", null, {
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
    secondaryFieldOptions: [{ value: "channelV2", label: "Channel" }],
});
assert.deepEqual(kpiDraft, {
    kind: "kpiBlock",
    id: "kpiBlock",
    title: "Headline KPI",
    datasetRef: "primary",
    valueField: "avails",
    valueLabel: "Avails",
    secondaryField: "",
    secondaryLabel: "",
    description: "",
    emptyLabel: "No KPI value available.",
});

const badgesDraft = buildReportBuilderDocumentBlockDraft("badgesBlock");
assert.deepEqual(badgesDraft, {
    kind: "badgesBlock",
    id: "badgesBlock",
    title: "Status Pills",
    datasetRef: "primary",
    items: [
        {
            id: "badge_1",
            label: "",
            value: "",
            valueField: "",
            format: "",
            labelMode: "field",
            rulesText: "",
            tone: "info",
        },
    ],
});

assert.deepEqual(resolveReportBuilderBadgeRuleRows({
    rules: [
        { value: "AE", label: "United Arab Emirates", tone: "success" },
    ],
}), [
    { value: "AE", label: "United Arab Emirates", tone: "success" },
]);

assert.deepEqual(parseReportBuilderBadgeRuleRows('[\n  { "value": "AE", "label": "United Arab Emirates", "tone": "success" }\n]'), {
    valid: true,
    rules: [
        { value: "AE", label: "United Arab Emirates", tone: "success" },
    ],
    error: "",
});

assert.equal(
    serializeReportBuilderBadgeRuleRows([
        { value: "AE", label: "United Arab Emirates", tone: "success" },
    ]),
    JSON.stringify([
        { value: "AE", label: "United Arab Emirates", tone: "success" },
    ], null, 2),
);

const tableDraft = buildReportBuilderDocumentBlockDraft("tableBlock", null, {
    tableColumnOptions: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", format: "date" },
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channel.channel",
            displayValueMap: { "1": "Display" },
            label: "Channel",
        },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber" },
    ],
});
assert.deepEqual(tableDraft, {
    kind: "tableBlock",
    id: "tableBlock",
    title: "Detail Table",
    datasetRef: "primary",
    columnKeys: ["eventDate", "channelV2", "avails"],
    columns: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", format: "date" },
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channel.channel",
            displayValueMap: { "1": "Display" },
            label: "Channel",
        },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber" },
    ],
    columnVisualKinds: {},
    columnVisualRuleTexts: {},
});

const currentSelectionFieldOptions = buildReportBuilderDocumentBlockFieldOptions({
    config: {
        dimensions: [
            { id: "eventDate", key: "eventDate", label: "Event Date" },
            { id: "channelV2", key: "channelV2", label: "Channel" },
            { id: "publisher", key: "publisher", label: "Publisher" },
        ],
        measures: [
            { id: "avails", key: "avails", label: "Avails", format: "compactNumber" },
            { id: "hhUniqs", key: "hhUniqs", label: "HH Uniques", format: "compactNumber" },
        ],
    },
    state: {
        selectedDimensions: ["eventDate", "channelV2"],
        selectedMeasures: ["avails"],
        primaryMeasure: "avails",
    },
});

const currentSelectionTableDraft = buildReportBuilderDocumentBlockDraft("tableBlock", null, {
    tableColumnOptions: currentSelectionFieldOptions.tableColumnOptions,
});

assert.deepEqual(currentSelectionTableDraft.columnKeys, ["eventDate", "channelV2", "avails"]);
assert.deepEqual(
    currentSelectionTableDraft.columns.map((column) => column.key),
    ["eventDate", "channelV2", "avails"],
);

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "scopeFilters",
    title: "Filters",
    datasetRef: "primary",
    paramIds: ["dateRange", "channels"],
}, {
    datasetRef: "forecast_cube",
    scopeParamOptions: [{ value: "region", label: "Region" }],
}), {
    kind: "filterBarBlock",
    id: "scopeFilters",
    title: "Filters",
    datasetRef: "forecast_cube",
    paramIds: ["region"],
});

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "singleDatasetFilters",
    title: "Filters",
    paramIds: [],
}, {
    datasetOptions: [
        {
            value: "forecast_cube",
            scopeParamOptions: [],
        },
    ],
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
}), {
    kind: "filterBarBlock",
    id: "singleDatasetFilters",
    title: "Filters",
    datasetRef: "forecast_cube",
    paramIds: ["dateRange"],
});

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "tableBlock",
    id: "regionalMixTable",
    title: "Regional Mix",
    datasetRef: "regional_mix_csv",
    columnKeys: ["region", "revenue"],
    columns: [
        { key: "region", label: "Region" },
        { key: "revenue", label: "Revenue" },
    ],
}, {
    datasetRef: "primary",
    tableColumnOptions: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date", kind: "dimension", selected: true },
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channel.channel",
            displayValueMap: { "1": "Display" },
            label: "Channel",
            kind: "dimension",
            selected: true,
        },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure", selected: true, format: "compactNumber" },
    ],
}), {
    kind: "tableBlock",
    id: "regionalMixTable",
    title: "Regional Mix",
    datasetRef: "primary",
    columnKeys: ["eventDate", "channelV2", "avails"],
    columns: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Date" },
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channel.channel",
            displayValueMap: { "1": "Display" },
            label: "Channel",
        },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber" },
    ],
});

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "kpiBlock",
    id: "kpi1",
    title: "Headline KPI",
    datasetRef: "regional_mix_csv",
    valueField: "revenue",
    valueLabel: "Revenue",
    secondaryField: "region",
    secondaryLabel: "Region",
    description: "",
    emptyLabel: "No KPI value available.",
}, {
    datasetRef: "primary",
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
    secondaryFieldOptions: [{ value: "channelV2", label: "Channel" }],
}), {
    kind: "kpiBlock",
    id: "kpi1",
    title: "Headline KPI",
    datasetRef: "primary",
    valueField: "avails",
    valueLabel: "Avails",
    secondaryField: "",
    secondaryLabel: "",
    description: "",
    emptyLabel: "No KPI value available.",
});

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "chartBlock",
    id: "chart1",
    title: "Regional Revenue",
    datasetRef: "regional_mix_csv",
    chartSpec: {
        title: "Regional Revenue",
        type: "bar",
        xField: "region",
        yFields: ["forecastRevenue"],
    },
}, {
    datasetRef: "primary",
    datasetOptions: [
        {
            value: "primary",
            chartFieldOptions: [
                { key: "eventDate", label: "Date", kind: "dimension" },
                { key: "channelV2", label: "Channel", kind: "dimension" },
                { key: "avails", label: "Avails", kind: "measure" },
            ],
        },
    ],
}), {
    kind: "chartBlock",
    id: "chart1",
    title: "Regional Revenue",
    datasetRef: "primary",
    chartSpec: {
        title: "Regional Revenue",
        type: "bar",
        xField: "eventDate",
        yFields: ["avails"],
    },
});

assert.deepEqual(rebindReportBuilderDocumentBlockDraft({
    kind: "badgesBlock",
    id: "statusPills",
    title: "Status Pills",
    datasetRef: "regional_mix_csv",
    items: [
        { id: "badge_1", label: "Region", valueField: "region", value: "", tone: "info" },
        { id: "badge_2", label: "Revenue", valueField: "revenue", value: "", tone: "success" },
    ],
}, {
    datasetRef: "primary",
    tableColumnOptions: [
        { key: "eventDate", label: "Date", kind: "dimension", selected: true },
        { key: "channelV2", label: "Channel", kind: "dimension", selected: true },
        { key: "avails", label: "Avails", kind: "measure", selected: true, format: "compactNumber" },
    ],
}), {
    kind: "badgesBlock",
    id: "statusPills",
    title: "Status Pills",
    datasetRef: "primary",
    items: [
        { id: "badge_1", label: "Region", value: "", valueField: "", format: "", labelMode: "manual", rulesText: "", tone: "info" },
        { id: "badge_2", label: "Revenue", value: "", valueField: "", format: "", labelMode: "manual", rulesText: "", tone: "success" },
    ],
});

assert.deepEqual(buildReportBuilderDocumentBlockDraft("badgesBlock", {
    kind: "badgesBlock",
    id: "deliveryFlags",
    title: "Delivery Flags",
    datasetRef: "primary",
    items: [
        {
            id: "pace",
            label: "Pacing",
            valueField: "status",
            tone: "info",
            rules: [
                { value: "LIVE_UNDERPACING_WITH_DELIVERY", label: "Underpacing", tone: "warning" },
            ],
        },
    ],
}), {
    kind: "badgesBlock",
    id: "deliveryFlags",
    title: "Delivery Flags",
    datasetRef: "primary",
    items: [
        {
            id: "pace",
            label: "Pacing",
            value: "",
            valueField: "status",
            labelMode: "manual",
            rules: [
                { value: "LIVE_UNDERPACING_WITH_DELIVERY", label: "Underpacing", tone: "warning" },
            ],
            tone: "info",
            rulesText: JSON.stringify([
                { value: "LIVE_UNDERPACING_WITH_DELIVERY", label: "Underpacing", tone: "warning" },
            ], null, 2),
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "scopeFilters",
    paramIds: [],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
}), {
    valid: false,
    errors: [
        {
            field: "paramIds",
            code: "required",
            message: "Select at least one report filter for the filter bar block.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "singleDatasetScopeFilters",
    paramIds: ["dateRange"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
    datasetOptions: [
        { value: "forecast_cube", scopeParamOptions: [] },
    ],
}), {
    valid: true,
    errors: [],
});

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        kind: "tableBlock",
        id: "regionalMixTable",
        title: "Regional Mix",
        datasetRef: "regional_mix_csv",
        columnKeys: ["region", "revenue"],
        columns: [
            { key: "region", label: "Region" },
            { key: "revenue", label: "Revenue" },
        ],
    },
], {
    datasetOptions: [
        { value: "primary", label: "Forecasting Cube Report" },
    ],
}), [
    {
        id: "documentBlockDatasetUnavailable:regionalMixTable:regional_mix_csv",
        code: "documentBlockDatasetUnavailable",
        severity: "error",
        blockId: "regionalMixTable",
        path: "reportDocument.blocks.regionalMixTable.datasetRef",
        message: "Regional Mix references unavailable data source 'regional_mix_csv'.",
        suggestedFix: "Edit the authored block to bind it to one of the current data sources or re-import the missing static dataset.",
    },
    {
        id: "documentBlockColumnUnavailable:regionalMixTable:region",
        code: "documentBlockColumnUnavailable",
        severity: "error",
        blockId: "regionalMixTable",
        path: "reportDocument.blocks.regionalMixTable.columns[0]",
        message: "Regional Mix references unavailable table column 'region'.",
        suggestedFix: "Edit the table block to use one of the current available fields or restore the missing field in the builder.",
    },
    {
        id: "documentBlockColumnUnavailable:regionalMixTable:revenue",
        code: "documentBlockColumnUnavailable",
        severity: "error",
        blockId: "regionalMixTable",
        path: "reportDocument.blocks.regionalMixTable.columns[1]",
        message: "Regional Mix references unavailable table column 'revenue'.",
        suggestedFix: "Edit the table block to use one of the current available fields or restore the missing field in the builder.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        kind: "kpiBlock",
        id: "headlineKpi",
        title: "Headline KPI",
        datasetRef: "regional_mix_csv",
        valueField: "revenue",
        secondaryField: "region",
    },
], {
    datasetOptions: [
        { value: "primary", label: "Forecasting Cube Report", valueFieldOptions: [{ value: "avails", label: "Avails" }], secondaryFieldOptions: [{ value: "channelV2", label: "Channel" }] },
        { value: "regional_mix_csv", label: "Regional Mix CSV", valueFieldOptions: [{ value: "revenue", label: "Revenue" }, { value: "orders", label: "Orders" }], secondaryFieldOptions: [{ value: "region", label: "Region" }] },
    ],
}), []);

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "scopeFilters",
    datasetRef: "forecast_cube",
    paramIds: ["dateRange"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
    datasetOptions: [
        { value: "primary", scopeParamOptions: [{ value: "dateRange", label: "Date Range" }] },
        { value: "forecast_cube", scopeParamOptions: [{ value: "region", label: "Region" }] },
    ],
}), {
    valid: false,
    errors: [
        {
            field: "paramIds",
            code: "unknown",
            message: "One or more filter bar filters are not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "scopeFilters",
    datasetRef: "forecast_cube",
    paramIds: ["dateRange"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
    datasetOptions: [
        { value: "primary", scopeParamOptions: [{ value: "dateRange", label: "Date Range" }] },
        { value: "forecast_cube", scopeParamOptions: [] },
    ],
}), {
    valid: false,
    errors: [
        {
            field: "paramIds",
            code: "unknown",
            message: "One or more filter bar filters are not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "filterBarBlock",
    id: "scopeFilters",
    paramIds: ["missing"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
}), {
    valid: false,
    errors: [
        {
            field: "paramIds",
            code: "unknown",
            message: "One or more filter bar filters are not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "chartBlock",
    id: "trendChart",
    title: "Trend Chart",
    chartSpec: {
        title: "Trend Chart",
        type: "line",
        xField: "missingDimension",
        yFields: ["avails"],
    },
}, {
    chartConfig: {
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartFieldOptions: [
        { key: "eventDate", label: "Event Date", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure" },
    ],
}), {
    valid: false,
    errors: [
        {
            field: "xField",
            code: "missingField",
            message: "The chart X-axis field is not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "geoMapBlock",
    id: "stateGeo",
    title: "State Geo",
    geo: {
        shape: "us-states",
        key: "missingDimension",
        metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
        },
        aggregate: "sum",
    },
}, {
    tableColumnOptions: [
        { key: "country", label: "Country", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
    ],
}), {
    valid: false,
    errors: [
        {
            field: "geo.key",
            code: "unknown",
            message: "The selected geo key field is not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "kpiBlock",
    id: "headlineKpi",
    valueField: "missing",
}, {
    valueFieldOptions: [{ value: "avails", label: "Avails" }],
}), {
    valid: false,
    errors: [
        {
            field: "valueField",
            code: "unknown",
            message: "The selected KPI value field is not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "badgesBlock",
    id: "statusPills",
    items: [],
}, {}), {
    valid: false,
    errors: [
        {
            field: "items",
            code: "required",
            message: "Add at least one pill to the authored badges block.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "badgesBlock",
    id: "statusPills",
    items: [
        { id: "badge_1", label: "Region", valueField: "missingField", tone: "info" },
    ],
}, {
    tableColumnOptions: [{ key: "channelV2", label: "Channel", kind: "dimension" }],
}), {
    valid: false,
    errors: [
        {
            field: "items.0.valueField",
            code: "unknown",
            message: "The selected pill field 'missingField' is not available in the current builder.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "badgesBlock",
    id: "deliveryFlags",
    items: [
        {
            id: "pace",
            label: "Pacing",
            valueField: "status",
            tone: "info",
            rulesText: "not-json",
        },
    ],
}, {
    tableColumnOptions: [{ key: "status", label: "Status", kind: "dimension" }],
}), {
    valid: false,
    errors: [
        {
            field: "items.0.rulesText",
            code: "invalidRules",
            message: "Pacing: Pill rules must be valid JSON.",
        },
    ],
});

assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "tableBlock",
    id: "comparisonTable",
    columnKeys: [],
}, {
    tableColumnOptions: [{ key: "eventDate", label: "Event Date" }],
}), {
    valid: false,
    errors: [
        {
            field: "columnKeys",
            code: "required",
            message: "Select at least one breakdown or measure for the table block.",
        },
    ],
});
assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "tableBlock",
    id: "comparisonTable",
    columnKeys: ["eventDate"],
    columnVisualKinds: {
        eventDate: "dataBar",
    },
}, {
    tableColumnOptions: [{ key: "eventDate", label: "Event Date", kind: "dimension" }],
}), {
    valid: false,
    errors: [
        {
            field: "columnVisualKinds",
            code: "unsupported",
            message: "eventDate does not support data bars in the authored table block.",
        },
    ],
});
assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "tableBlock",
    id: "comparisonTable",
    columnKeys: ["channelV2"],
    columnVisualKinds: {
        channelV2: "badge",
    },
    columnVisualRuleTexts: {
        channelV2: "not-json",
    },
}, {
    tableColumnOptions: [{ key: "channelV2", label: "Channel", kind: "dimension" }],
}), {
    valid: false,
    errors: [
        {
            field: "columnVisualRuleTexts",
            code: "invalidRules",
            message: "channelV2: Badge rules must be valid JSON.",
        },
    ],
});
assert.deepEqual(validateReportBuilderDocumentBlockDraft({
    kind: "tableBlock",
    id: "comparisonTable",
    columnKeys: ["channelV2"],
    columnVisualKinds: {
        channelV2: "tone",
    },
    columnVisualRuleTexts: {
        channelV2: "[\n  { \"value\": \"Display\", \"tone\": \"info\", \"label\": \"Display\" }\n]",
    },
}, {
    tableColumnOptions: [{ key: "channelV2", label: "Channel", kind: "dimension" }],
}), {
    valid: true,
    errors: [],
});

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "scopeFilters",
        kind: "filterBarBlock",
        title: "Filters",
        paramIds: ["missingScope"],
    },
    {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        secondaryField: "channelV2",
    },
], {
    valueFieldOptions: [{ value: "hhUniqs", label: "HH Uniques" }],
    secondaryFieldOptions: [{ value: "country", label: "Country" }],
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
}), [
    {
        id: "documentBlockScopeParamUnavailable:scopeFilters:missingScope",
        code: "documentBlockScopeParamUnavailable",
        severity: "error",
        blockId: "scopeFilters",
        path: "reportDocument.blocks.scopeFilters.paramIds[0]",
        message: "Filters references unavailable report filter 'missingScope'.",
        suggestedFix: "Edit the filter bar block to use one of the current available report filters or remove the authored block.",
    },
    {
        id: "documentBlockValueFieldUnavailable:headlineKpi",
        code: "documentBlockValueFieldUnavailable",
        severity: "error",
        blockId: "headlineKpi",
        path: "reportDocument.blocks.headlineKpi.valueField",
        message: "Headline KPI references unavailable KPI value field 'avails'.",
        suggestedFix: "Edit the KPI block to use one of the current available measures or restore the missing measure in the builder.",
    },
    {
        id: "documentBlockSecondaryFieldUnavailable:headlineKpi",
        code: "documentBlockSecondaryFieldUnavailable",
        severity: "error",
        blockId: "headlineKpi",
        path: "reportDocument.blocks.headlineKpi.secondaryField",
        message: "Headline KPI references unavailable KPI secondary field 'channelV2'.",
        suggestedFix: "Edit the KPI block to use one of the current available breakdowns or restore the missing field in the builder.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        secondaryField: "channelV2",
    },
], {
    valueFieldOptions: [{ value: "hhUniqs", label: "HH Uniques" }],
    secondaryFieldOptions: [{ value: "country", label: "Country" }],
}), [
    {
        id: "documentBlockValueFieldUnavailable:headlineKpi",
        code: "documentBlockValueFieldUnavailable",
        severity: "error",
        blockId: "headlineKpi",
        path: "reportDocument.blocks.headlineKpi.valueField",
        message: "Headline KPI references unavailable KPI value field 'avails'.",
        suggestedFix: "Edit the KPI block to use one of the current available measures or restore the missing measure in the builder.",
    },
    {
        id: "documentBlockSecondaryFieldUnavailable:headlineKpi",
        code: "documentBlockSecondaryFieldUnavailable",
        severity: "error",
        blockId: "headlineKpi",
        path: "reportDocument.blocks.headlineKpi.secondaryField",
        message: "Headline KPI references unavailable KPI secondary field 'channelV2'.",
        suggestedFix: "Edit the KPI block to use one of the current available breakdowns or restore the missing field in the builder.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "statusPills",
        kind: "badgesBlock",
        title: "Status Pills",
        items: [],
    },
], {}), [
    {
        id: "documentBlockBadgesEmpty:statusPills",
        code: "documentBlockBadgesEmpty",
        severity: "error",
        blockId: "statusPills",
        path: "reportDocument.blocks.statusPills.items",
        message: "Status Pills does not define any pills.",
        suggestedFix: "Edit the pills block and add at least one visible pill.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "statusPills",
        kind: "badgesBlock",
        title: "Status Pills",
        datasetRef: "primary",
        items: [
            { id: "badge_1", label: "Region", valueField: "region", tone: "info" },
        ],
    },
], {
    tableColumnOptions: [{ key: "channelV2", label: "Channel", kind: "dimension" }],
}), [
    {
        id: "documentBlockBadgeValueFieldUnavailable:statusPills:region",
        code: "documentBlockBadgeValueFieldUnavailable",
        severity: "error",
        blockId: "statusPills",
        path: "reportDocument.blocks.statusPills.items[0].valueField",
        message: "Status Pills references unavailable pill field 'region'.",
        suggestedFix: "Edit the pills block to use one of the current available fields or clear the field-backed value.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "trendChart",
        kind: "chartBlock",
        title: "Trend Chart",
        datasetRef: "primary",
        chartSpec: {
            title: "Trend Chart",
            type: "line",
            xField: "missingDimension",
            yFields: ["avails"],
        },
    },
], {
    chartConfig: {
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartFieldOptions: [
        { key: "eventDate", label: "Event Date", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure" },
    ],
}), [
    {
        id: "documentBlockChartInvalid:trendChart:xField:1",
        code: "documentBlockChartInvalid",
        severity: "error",
        blockId: "trendChart",
        path: "reportDocument.blocks.trendChart.chartSpec.xField",
        message: "Trend Chart is no longer compatible with the current builder. The chart X-axis field is not available in the current builder.",
        suggestedFix: "Edit the chart block to use one of the current builder fields or restore the missing chart fields in the builder.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "stateGeo",
        kind: "geoMapBlock",
        title: "State Geo",
        datasetRef: "primary",
        geo: {
            key: "missingDimension",
            metric: {
                key: "missingMetric",
                label: "Missing Metric",
            },
        },
    },
], {
    tableColumnOptions: [
        { key: "country", label: "Country", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure" },
    ],
}), [
    {
        id: "documentBlockGeoKeyUnavailable:stateGeo:missingDimension",
        code: "documentBlockGeoKeyUnavailable",
        severity: "error",
        blockId: "stateGeo",
        path: "reportDocument.blocks.stateGeo.geo.key",
        message: "State Geo references unavailable geo key field 'missingDimension'.",
        suggestedFix: "Edit the geo block to use one of the current available breakdowns or restore the missing field in the builder.",
    },
    {
        id: "documentBlockGeoMetricUnavailable:stateGeo:missingMetric",
        code: "documentBlockGeoMetricUnavailable",
        severity: "error",
        blockId: "stateGeo",
        path: "reportDocument.blocks.stateGeo.geo.metric.key",
        message: "State Geo references unavailable geo metric field 'missingMetric'.",
        suggestedFix: "Edit the geo block to use one of the current available measures or restore the missing measure in the builder.",
    },
]);

const authoredBlocks = [
    {
        id: "narrativeIntro",
        kind: "markdownBlock",
        title: "Narrative",
        markdown: "## Narrative\nAuthored context.",
    },
    {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        valueLabel: "Avails",
    },
];

assert.deepEqual(normalizeReportBuilderDocumentLayoutState({
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "headlineKpi" },
    ],
}, authoredBlocks), {
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "headlineKpi" },
        { blockId: "primaryBuilder" },
    ],
});

assert.deepEqual(normalizeReportBuilderDocumentLayoutState({
    type: "stack",
    items: [
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi", size: "half" },
    ],
}, authoredBlocks), {
    type: "stack",
    items: [
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi", size: "half" },
    ],
});

const initialState = {
    reportDocumentBlocks: authoredBlocks,
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "narrativeIntro" },
            { blockId: "primaryBuilder" },
            { blockId: "headlineKpi" },
        ],
    },
};

assert.deepEqual(buildReportBuilderDocumentBlockFieldOptions({
    config: {
        measures: [
            { id: "avails", label: "Avails", default: true },
            { id: "hhUniqs", label: "HH Uniques" },
        ],
        dimensions: [
            { id: "eventDate", label: "Event Date", default: true },
            { id: "channelV2", label: "Channel" },
        ],
        staticFilters: [
            { id: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview.", type: "dateRange", required: true },
        ],
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    state: {
        selectedMeasures: ["hhUniqs"],
        selectedDimensions: ["channelV2"],
    },
}), {
    valueFieldOptions: [
        { value: "hhUniqs", label: "HH Uniques" },
        { value: "avails", label: "Avails" },
    ],
    secondaryFieldOptions: [
        { value: "channelV2", label: "Channel" },
        { value: "eventDate", label: "Event Date" },
    ],
    tableColumnOptions: [
        { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension", selected: true },
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", kind: "dimension", selected: false },
        { key: "hhUniqs", sourceKey: "hhUniqs", displayKey: "hhUniqs", label: "HH Uniques", kind: "measure", selected: true },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure", selected: false },
    ],
    scopeParamOptions: [
        { value: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview.", kind: "dateRange", required: true },
    ],
    datasetOptions: [
        {
            value: "primary",
            dataSourceRef: "",
            label: "Primary",
            description: "",
            kindLabel: "published",
            columnOptions: [
                { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension", selected: true },
                { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", kind: "dimension", selected: false },
                { key: "hhUniqs", sourceKey: "hhUniqs", displayKey: "hhUniqs", label: "HH Uniques", kind: "measure", selected: true },
                { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", kind: "measure", selected: false },
            ],
            valueFieldOptions: [
                { value: "hhUniqs", label: "HH Uniques" },
                { value: "avails", label: "Avails" },
            ],
            secondaryFieldOptions: [
                { value: "channelV2", label: "Channel" },
                { value: "eventDate", label: "Event Date" },
            ],
            chartFieldOptions: [
                { key: "channelV2", aliases: ["channelV2"], label: "Channel", kind: "dimension", format: undefined, align: undefined },
                { key: "eventDate", aliases: ["eventDate"], label: "Event Date", kind: "dimension", format: undefined, align: undefined },
                { key: "hhUniqs", aliases: ["hhUniqs"], label: "HH Uniques", kind: "measure", format: undefined, align: "right" },
                { key: "avails", aliases: ["avails"], label: "Avails", kind: "measure", format: undefined, align: "right" },
            ],
            scopeParamOptions: [
                { value: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview.", kind: "dateRange", required: true },
            ],
        },
    ],
    chartFieldOptions: [
        { key: "channelV2", aliases: ["channelV2"], label: "Channel", kind: "dimension", format: undefined, align: undefined },
        { key: "eventDate", aliases: ["eventDate"], label: "Event Date", kind: "dimension", format: undefined, align: undefined },
        { key: "hhUniqs", aliases: ["hhUniqs"], label: "HH Uniques", kind: "measure", format: undefined, align: "right" },
        { key: "avails", aliases: ["avails"], label: "Avails", kind: "measure", format: undefined, align: "right" },
    ],
    supportedChartTypes: ["line", "horizontal_bar"],
    chartConfig: {
        measures: [
            { id: "avails", label: "Avails", default: true },
            { id: "hhUniqs", label: "HH Uniques" },
        ],
        dimensions: [
            { id: "eventDate", label: "Event Date", default: true },
            { id: "channelV2", label: "Channel" },
        ],
        staticFilters: [
            { id: "dateRange", label: "Date Range", description: "Approved reporting window for semantic preview.", type: "dateRange", required: true },
        ],
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartState: {
        selectedMeasures: ["hhUniqs", "avails"],
        selectedDimensions: ["channelV2", "eventDate"],
        primaryMeasure: "hhUniqs",
    },
});

{
    // scope param options derive from predicate-native pinned params without
    // lowering; residual legacy staticFilters only ride along as fallback.
    const predicateFieldOptions = buildReportBuilderDocumentBlockFieldOptions({
        config: {
            measures: [{ id: "avails", label: "Avails", default: true }],
            dimensions: [{ id: "eventDate", label: "Event Date", default: true }],
            predicates: [
                {
                    id: "channels",
                    label: "Channels",
                    description: "Delivery channel scope.",
                    pinned: true,
                    multiple: true,
                    paramPath: "filters.includeChannelV2",
                },
                {
                    id: "dateRange",
                    label: "Date Range",
                    kind: "dateRange",
                    required: true,
                    startParamPath: "filters.from",
                    endParamPath: "filters.to",
                },
                {
                    id: "publisher",
                    label: "Publisher",
                    include: true,
                },
            ],
            staticFilters: [
                { id: "legacyOnly", label: "Legacy Only" },
            ],
        },
        state: {
            selectedMeasures: ["avails"],
            selectedDimensions: ["eventDate"],
        },
    });
    assert.deepEqual(predicateFieldOptions.scopeParamOptions, [
        { value: "legacyOnly", label: "Legacy Only", kind: "value", required: false },
        { value: "channels", label: "Channels", description: "Delivery channel scope.", kind: "multiSelect", required: false },
        { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
    ]);
}

assert.deepEqual(buildReportBuilderDocumentBlockFieldOptions({
    config: {
        measures: [
            {
                id: "avails",
                rawId: "available_impressions",
                semanticRef: "available_impressions",
                label: "Available Impressions",
                description: "Certified available inventory.",
                category: "Metrics",
                format: "compactNumber",
                governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
                default: true,
            },
        ],
        dimensions: [
            {
                id: "country",
                rawId: "country_code",
                semanticRef: "country_code",
                label: "Country",
                description: "Approved market dimension.",
                category: "Location",
                definitionRef: "semantic://example/country",
                governance: { status: "approved" },
                default: true,
            },
        ],
        result: {
            supportedChartTypes: ["line"],
        },
    },
    state: {
        selectedMeasures: ["avails"],
        selectedDimensions: ["country"],
    },
}), {
    valueFieldOptions: [
        {
            value: "avails",
            rawId: "available_impressions",
            label: "Available Impressions",
            format: "compactNumber",
            description: "Certified available inventory.",
            category: "Metrics",
            semanticRef: "available_impressions",
            governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
        },
    ],
    secondaryFieldOptions: [
        {
            value: "country",
            rawId: "country_code",
            label: "Country",
            description: "Approved market dimension.",
            category: "Location",
            definitionRef: "semantic://example/country",
            semanticRef: "country_code",
            governance: { status: "approved" },
        },
    ],
    tableColumnOptions: [
        {
            key: "country",
            sourceKey: "country",
            displayKey: "country",
            rawId: "country_code",
            label: "Country",
            kind: "dimension",
            selected: true,
            description: "Approved market dimension.",
            category: "Location",
            definitionRef: "semantic://example/country",
            semanticRef: "country_code",
            governance: { status: "approved" },
        },
        {
            key: "avails",
            sourceKey: "avails",
            displayKey: "avails",
            rawId: "available_impressions",
            label: "Available Impressions",
            kind: "measure",
            selected: true,
            format: "compactNumber",
            description: "Certified available inventory.",
            category: "Metrics",
            semanticRef: "available_impressions",
            governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
        },
    ],
    scopeParamOptions: [],
    datasetOptions: [
        {
            value: "primary",
            dataSourceRef: "",
            label: "Primary",
            description: "",
            kindLabel: "published",
            columnOptions: [
                {
                    key: "country",
                    sourceKey: "country",
                    displayKey: "country",
                    rawId: "country_code",
                    label: "Country",
                    kind: "dimension",
                    selected: true,
                    description: "Approved market dimension.",
                    category: "Location",
                    definitionRef: "semantic://example/country",
                    semanticRef: "country_code",
                    governance: { status: "approved" },
                },
                {
                    key: "avails",
                    sourceKey: "avails",
                    displayKey: "avails",
                    rawId: "available_impressions",
                    label: "Available Impressions",
                    kind: "measure",
                    selected: true,
                    format: "compactNumber",
                    description: "Certified available inventory.",
                    category: "Metrics",
                    semanticRef: "available_impressions",
                    governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
                },
            ],
            valueFieldOptions: [
                {
                    value: "avails",
                    rawId: "available_impressions",
                    label: "Available Impressions",
                    format: "compactNumber",
                    description: "Certified available inventory.",
                    category: "Metrics",
                    semanticRef: "available_impressions",
                    governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
                },
            ],
            secondaryFieldOptions: [
                {
                    value: "country",
                    rawId: "country_code",
                    label: "Country",
                    description: "Approved market dimension.",
                    category: "Location",
                    definitionRef: "semantic://example/country",
                    semanticRef: "country_code",
                    governance: { status: "approved" },
                },
            ],
            chartFieldOptions: [
                { key: "country", aliases: ["country"], label: "Country", kind: "dimension", format: undefined, align: undefined },
                { key: "avails", aliases: ["avails"], label: "Available Impressions", kind: "measure", format: "compactNumber", align: "right" },
            ],
            scopeParamOptions: [],
        },
    ],
    chartFieldOptions: [
        { key: "country", aliases: ["country"], label: "Country", kind: "dimension", format: undefined, align: undefined },
        { key: "avails", aliases: ["avails"], label: "Available Impressions", kind: "measure", format: "compactNumber", align: "right" },
    ],
    supportedChartTypes: ["line"],
    chartConfig: {
        measures: [
            {
                id: "avails",
                rawId: "available_impressions",
                semanticRef: "available_impressions",
                label: "Available Impressions",
                description: "Certified available inventory.",
                category: "Metrics",
                format: "compactNumber",
                governance: { status: "approved", certification: "certified", ownerRef: "team://example/performance" },
                default: true,
            },
        ],
        dimensions: [
            {
                id: "country",
                rawId: "country_code",
                semanticRef: "country_code",
                label: "Country",
                description: "Approved market dimension.",
                category: "Location",
                definitionRef: "semantic://example/country",
                governance: { status: "approved" },
                default: true,
            },
        ],
        result: {
            supportedChartTypes: ["line"],
        },
    },
    chartState: {
        selectedMeasures: ["avails"],
        selectedDimensions: ["country"],
        primaryMeasure: "avails",
    },
});

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    document: {
        version: 1,
        kind: "reportDocument",
        datasets: [
            {
                id: "segment_status_csv",
                label: "Segment Status",
                sourceFormat: "csv",
                columns: [
                    { key: "segment", label: "Segment", kind: "dimension" },
                    { key: "score", label: "Score", kind: "measure" },
                    { key: "status", label: "Status", kind: "dimension" },
                ],
                rows: [
                    { segment: "North", score: 10, status: "healthy" },
                    { segment: "South", score: 7, status: "watch" },
                ],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", label: "Avails", default: true },
                        { id: "hhUniqs", label: "HH Uniques" },
                    ],
                    dimensions: [
                        { id: "eventDate", label: "Event Date", default: true },
                        { id: "channelV2", label: "Channel" },
                    ],
                    result: {
                        supportedChartTypes: ["line", "horizontal_bar"],
                    },
                },
                state: {
                    selectedMeasures: ["hhUniqs"],
                    selectedDimensions: ["eventDate"],
                },
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Avails",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
    },
}), []);

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    document: {
        version: 1,
        kind: "reportDocument",
        datasets: [
            {
                id: "primary",
                dataSourceRef: "demoReportSource",
                label: "Primary",
                kindLabel: "primary",
                columnOptions: [
                    { key: "eventDate", label: "Event Date", kind: "dimension" },
                    { key: "channelV2", label: "Channel", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure" },
                ],
                valueFieldOptions: [
                    { value: "avails", label: "Avails" },
                ],
                secondaryFieldOptions: [
                    { value: "eventDate", label: "Event Date" },
                    { value: "channelV2", label: "Channel" },
                ],
                chartFieldOptions: [
                    { key: "eventDate", label: "Event Date", kind: "dimension" },
                    { key: "channelV2", label: "Channel", kind: "dimension" },
                    { key: "avails", label: "Avails", kind: "measure" },
                ],
                scopeParamOptions: [
                    { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
                ],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                source: {
                    dataSourceRef: "demoReportSource",
                },
                state: {
                    selectedMeasures: ["avails"],
                    selectedDimensions: ["eventDate"],
                },
            },
            {
                id: "headlineKpi",
                kind: "kpiBlock",
                title: "Headline KPI",
                datasetRef: "primary",
                valueField: "avails",
                valueLabel: "Avails",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
        ],
    },
}), []);

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    document: {
        version: 1,
        kind: "reportDocument",
        datasets: [
            {
                id: "segment_status_csv",
                label: "Segment Status",
                sourceFormat: "csv",
                columns: [
                    { key: "segment", label: "Segment", kind: "dimension" },
                    { key: "score", label: "Score", kind: "measure" },
                    { key: "status", label: "Status", kind: "dimension" },
                ],
                rows: [
                    { segment: "North", score: 10, status: "healthy" },
                    { segment: "South", score: 7, status: "watch" },
                ],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", label: "Avails", default: true },
                    ],
                    dimensions: [
                        { id: "channelV2", label: "Channel" },
                    ],
                },
                state: {
                    selectedMeasures: ["avails"],
                    selectedDimensions: ["channelV2"],
                    localTableCalculations: [
                        {
                            id: "reachShare",
                            key: "reachShare",
                            label: "Reach Share",
                            format: "percent",
                            compute: {
                                type: "percentOfTotal",
                                sourceField: "avails",
                                scale: 100,
                                decimals: 1,
                            },
                        },
                    ],
                },
            },
            {
                id: "reachShareKpi",
                kind: "kpiBlock",
                title: "Reach Share KPI",
                datasetRef: "primary",
                valueField: "reachShare",
                valueLabel: "Reach Share",
                secondaryField: "channelV2",
                secondaryLabel: "Channel",
            },
            {
                id: "reachShareChart",
                kind: "chartBlock",
                title: "Reach Share by Channel",
                datasetRef: "primary",
                chartSpec: {
                    title: "Reach Share by Channel",
                    type: "line",
                    xField: "channelV2",
                    yFields: ["reachShare"],
                },
            },
        ],
    },
}), []);

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    document: {
        version: 1,
        kind: "reportDocument",
        datasets: [
            {
                id: "segment_status_csv",
                label: "Segment Status",
                sourceFormat: "csv",
                columns: [
                    { key: "segment", label: "Segment", kind: "dimension" },
                    { key: "score", label: "Score", kind: "measure" },
                    { key: "status", label: "Status", kind: "dimension" },
                ],
                rows: [
                    { segment: "North", score: 10, status: "healthy" },
                    { segment: "South", score: 7, status: "watch" },
                ],
            },
        ],
        blocks: [
            {
                id: "primaryBuilder",
                kind: "reportBuilderBlock",
                config: {
                    measures: [
                        { id: "avails", label: "Avails", default: true },
                    ],
                    dimensions: [
                        { id: "eventDate", label: "Event Date", default: true },
                    ],
                },
                state: {
                    selectedMeasures: ["avails"],
                    selectedDimensions: ["eventDate"],
                },
            },
            {
                id: "segmentScoreKpi",
                kind: "kpiBlock",
                title: "Segment Score KPI",
                datasetRef: "segment_status_csv",
                valueField: "score",
                valueLabel: "Score",
                secondaryField: "segment",
                secondaryLabel: "Segment",
            },
            {
                id: "segmentScoreTable",
                kind: "tableBlock",
                title: "Segment Score Table",
                datasetRef: "segment_status_csv",
                columns: [
                    { key: "segment", label: "Segment" },
                    { key: "score", label: "Score" },
                    { key: "status", label: "Status" },
                ],
            },
        ],
    },
}), []);

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    config: {
        measures: [
            { id: "avails", label: "Avails", default: true },
        ],
        dimensions: [
            { id: "eventDate", label: "Event Date", default: true },
        ],
    },
    state: {
        selectedMeasures: ["avails"],
        selectedDimensions: ["eventDate"],
        reportStaticDatasets: [
            {
                id: "segment_status_csv",
                label: "Segment Status",
                sourceFormat: "csv",
                columns: [
                    { key: "segment", label: "Segment", kind: "dimension" },
                    { key: "score", label: "Score", kind: "measure" },
                ],
                rows: [
                    { segment: "North", score: 10 },
                ],
            },
        ],
        reportDocumentBlocks: [
            {
                id: "segmentScoreKpi",
                kind: "kpiBlock",
                title: "Segment Score KPI",
                datasetRef: "segment_status_csv",
                valueField: "score",
                valueLabel: "Score",
                secondaryField: "segment",
                secondaryLabel: "Segment",
            },
        ],
    },
}), []);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "comparisonTable",
        kind: "tableBlock",
        title: "Comparison Table",
        datasetRef: "primary",
        columns: [
            { key: "eventDate", label: "Event Date" },
            { key: "missingMetric", label: "Missing Metric" },
        ],
    },
], {
    tableColumnOptions: [
        { key: "eventDate", label: "Event Date" },
        { key: "avails", label: "Available Impressions" },
    ],
}), [
    {
        id: "documentBlockColumnUnavailable:comparisonTable:missingMetric",
        code: "documentBlockColumnUnavailable",
        severity: "error",
        blockId: "comparisonTable",
        path: "reportDocument.blocks.comparisonTable.columns[1]",
        message: "Comparison Table references unavailable table column 'missingMetric'.",
        suggestedFix: "Edit the table block to use one of the current available fields or restore the missing field in the builder.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentBlockDiagnostics([
    {
        id: "emptyTable",
        kind: "tableBlock",
        title: "Empty Table",
        datasetRef: "primary",
        columns: [],
    },
], {
    tableColumnOptions: [
        { key: "eventDate", label: "Event Date" },
        { key: "avails", label: "Available Impressions" },
    ],
}), [
    {
        id: "documentBlockTableEmpty:emptyTable",
        code: "documentBlockTableEmpty",
        severity: "error",
        blockId: "emptyTable",
        path: "reportDocument.blocks.emptyTable.columns",
        message: "Empty Table does not define any table fields.",
        suggestedFix: "Edit the table block and apply at least one current dimension or measure.",
    },
]);

assert.deepEqual(buildReportBuilderDocumentCompileValidation([
    {
        code: "documentBlockValueFieldUnavailable",
        severity: "error",
        message: "Headline KPI references unavailable KPI value field 'avails'.",
    },
    {
        code: "note",
        severity: "warning",
        message: "Warning only.",
    },
]), {
    valid: false,
    diagnostics: [
        {
            code: "documentBlockValueFieldUnavailable",
            severity: "error",
            message: "Headline KPI references unavailable KPI value field 'avails'.",
        },
        {
            code: "note",
            severity: "warning",
            message: "Warning only.",
        },
    ],
    blockingDiagnostics: [
        {
            code: "documentBlockValueFieldUnavailable",
            severity: "error",
            message: "Headline KPI references unavailable KPI value field 'avails'.",
        },
    ],
    message: "Resolve authored block validation issues before preparing writable ReportDocument payloads.",
});

assert.deepEqual(
    resolveReportBuilderDocumentBlockList(initialState).map((block) => block.id),
    ["narrativeIntro", "headlineKpi"],
);

const editedMarkdownState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "markdownBlock",
    id: "narrativeIntro",
    title: "Updated Narrative",
    markdown: "## Narrative\nUpdated context.",
}, {
    editingId: "narrativeIntro",
});
assert.equal(editedMarkdownState.valid, true);
assert.equal(editedMarkdownState.created, false);
assert.equal(editedMarkdownState.nextState.reportDocumentBlocks[0].title, "Updated Narrative");

const addedFilterBarState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "filterBarBlock",
    id: "scopeFilters",
    title: "Filters",
    paramIds: ["dateRange"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
});
assert.equal(addedFilterBarState.valid, true);
assert.deepEqual(addedFilterBarState.block, {
    id: "scopeFilters",
    kind: "filterBarBlock",
    title: "Filters",
    datasetRef: "primary",
    paramIds: ["dateRange"],
});

const addedRefinementBarState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "refinementBarBlock",
    id: "trail",
    title: "Active Trail",
    actionKinds: ["remove", "clearAll", "undo", "redo"],
    emptyLabel: "No drill path selected",
});
assert.equal(addedRefinementBarState.valid, true);
assert.deepEqual(addedRefinementBarState.block, {
    id: "trail",
    kind: "refinementBarBlock",
    title: "Active Trail",
    actionKinds: ["remove", "clearAll", "undo", "redo"],
    emptyLabel: "No drill path selected",
});

const addedChartBlockState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "chartBlock",
    id: "trendChart",
    title: "Trend Chart",
    datasetRef: "primary",
    chartSpec: {
        title: "Trend Chart",
        type: "line",
        xField: "eventDate",
        yFields: ["avails"],
    },
}, {
    chartConfig: {
        result: {
            supportedChartTypes: ["line", "horizontal_bar"],
        },
    },
    chartFieldOptions: [
        { key: "eventDate", label: "Event Date", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure" },
    ],
});
assert.equal(addedChartBlockState.valid, true);
assert.deepEqual(addedChartBlockState.block, {
    id: "trendChart",
    kind: "chartBlock",
    title: "Trend Chart",
    datasetRef: "primary",
    chartSpec: {
        title: "Trend Chart",
        type: "line",
        xField: "eventDate",
        yFields: ["avails"],
    },
});

const addedGeoMapState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "geoMapBlock",
    id: "stateGeo",
    title: "State Geo",
    datasetRef: "primary",
    geo: {
        shape: "us-states",
        key: "country",
        metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
        },
        aggregate: "sum",
    },
}, {
    tableColumnOptions: [
        { key: "country", label: "Country", kind: "dimension" },
        { key: "avails", label: "Avails", kind: "measure", format: "compactNumber" },
    ],
});
assert.equal(addedGeoMapState.valid, true);
assert.deepEqual(addedGeoMapState.block, {
    id: "stateGeo",
    kind: "geoMapBlock",
    title: "State Geo",
    datasetRef: "primary",
    geo: {
        shape: "us-states",
        key: "country",
        metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
        },
        aggregate: "sum",
    },
});

const addedKpiState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "kpiBlock",
    id: "kpiBlock2",
    title: "Secondary KPI",
    datasetRef: "primary",
    valueField: "hhUniqs",
    valueLabel: "HH Uniques",
}, {
    valueFieldOptions: [
        { value: "avails", label: "Avails" },
        { value: "hhUniqs", label: "HH Uniques" },
    ],
});
assert.equal(addedKpiState.valid, true);
assert.equal(addedKpiState.created, true);
assert.deepEqual(
    addedKpiState.nextState.reportDocumentLayout.items,
    [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
        { blockId: "kpiBlock2" },
    ],
);

const insertedAfterPrimaryState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "markdownBlock",
    id: "postPrimaryNarrative",
    title: "Post Primary Narrative",
    markdown: "## Narrative\nPlaced after primary.",
}, {
    insertionAfterId: "primaryBuilder",
});
assert.equal(insertedAfterPrimaryState.valid, true);
assert.deepEqual(
    insertedAfterPrimaryState.nextState.reportDocumentLayout.items,
    [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "postPrimaryNarrative" },
        { blockId: "headlineKpi" },
    ],
);

const insertedBeforePrimaryState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "markdownBlock",
    id: "prePrimaryNarrative",
    title: "Pre Primary Narrative",
    markdown: "## Narrative\nPlaced before primary.",
}, {
    insertionAfterId: "primaryBuilder",
    insertionPlacement: "before",
});
assert.equal(insertedBeforePrimaryState.valid, true);
assert.deepEqual(
    insertedBeforePrimaryState.nextState.reportDocumentLayout.items,
    [
        { blockId: "narrativeIntro" },
        { blockId: "prePrimaryNarrative" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
);

const insertedAfterNarrativeState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "markdownBlock",
    id: "secondNarrative",
    title: "Second Narrative",
    markdown: "## Narrative\nPlaced after the selected authored block.",
}, {
    insertionAfterId: "narrativeIntro",
});
assert.equal(insertedAfterNarrativeState.valid, true);
assert.deepEqual(
    insertedAfterNarrativeState.nextState.reportDocumentLayout.items,
    [
        { blockId: "narrativeIntro" },
        { blockId: "secondNarrative" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
);

const insertedBeforeNarrativeState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "markdownBlock",
    id: "firstNarrative",
    title: "First Narrative",
    markdown: "## Narrative\nPlaced before the selected authored block.",
}, {
    insertionAfterId: "narrativeIntro",
    insertionPlacement: "before",
});
assert.equal(insertedBeforeNarrativeState.valid, true);
assert.deepEqual(
    insertedBeforeNarrativeState.nextState.reportDocumentLayout.items,
    [
        { blockId: "firstNarrative" },
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
);

const addedTableState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "tableBlock",
    id: "comparisonTable",
    title: "Comparison Table",
    datasetRef: "primary",
    columnKeys: ["eventDate", "avails"],
    columnVisualKinds: {
        avails: "dataBar",
    },
}, {
    tableColumnOptions: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", format: "date", kind: "dimension" },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
    ],
});
assert.equal(addedTableState.valid, true);
assert.deepEqual(addedTableState.block, {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Comparison Table",
    datasetRef: "primary",
    columns: [
        { key: "eventDate", sourceKey: "eventDate", displayKey: "eventDate", label: "Event Date", format: "date" },
        {
            key: "avails",
            sourceKey: "avails",
            displayKey: "avails",
            label: "Avails",
            format: "compactNumber",
            cellVisual: {
                kind: "dataBar",
                valueField: "avails",
                range: { mode: "columnMax" },
                palette: ["#dbeafe", "#2563eb"],
            },
        },
    ],
});

const addedBadgeTableState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "tableBlock",
    id: "comparisonTable",
    title: "Comparison Table",
    datasetRef: "primary",
    columnKeys: ["channelV2", "avails"],
    columnVisualKinds: {
        channelV2: "badge",
    },
    columnVisualRuleTexts: {
        channelV2: JSON.stringify([
            { value: "Display", tone: "info", label: "Display" },
        ]),
    },
}, {
    tableColumnOptions: [
        { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension" },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
    ],
});
assert.equal(addedBadgeTableState.valid, true);
assert.deepEqual(addedBadgeTableState.block, {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Comparison Table",
    datasetRef: "primary",
    columns: [
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channelV2",
            label: "Channel",
            cellVisual: {
                kind: "badge",
                rules: [
                    { value: "Display", tone: "info", label: "Display" },
                ],
            },
        },
        {
            key: "avails",
            sourceKey: "avails",
            displayKey: "avails",
            label: "Avails",
            format: "compactNumber",
        },
    ],
});

const addedToneTableState = upsertReportBuilderDocumentBlockState(initialState, {
    kind: "tableBlock",
    id: "comparisonTable",
    title: "Comparison Table",
    datasetRef: "primary",
    columnKeys: ["channelV2", "avails"],
    columnVisualKinds: {
        channelV2: "tone",
    },
    columnVisualRuleTexts: {
        channelV2: JSON.stringify([
            { value: "Display", tone: "info", label: "Display" },
        ]),
    },
}, {
    tableColumnOptions: [
        { key: "channelV2", sourceKey: "channelV2", displayKey: "channelV2", label: "Channel", kind: "dimension" },
        { key: "avails", sourceKey: "avails", displayKey: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
    ],
});
assert.equal(addedToneTableState.valid, true);
assert.deepEqual(addedToneTableState.block, {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Comparison Table",
    datasetRef: "primary",
    columns: [
        {
            key: "channelV2",
            sourceKey: "channelV2",
            displayKey: "channelV2",
            label: "Channel",
            cellVisual: {
                kind: "tone",
                rules: [
                    { value: "Display", tone: "info", label: "Display" },
                ],
            },
        },
        {
            key: "avails",
            sourceKey: "avails",
            displayKey: "avails",
            label: "Avails",
            format: "compactNumber",
        },
    ],
});

const movedState = moveReportBuilderDocumentBlockState(initialState, "headlineKpi", "up");
assert.deepEqual(movedState.reportDocumentLayout.items, [
    { blockId: "headlineKpi" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro" },
]);

const movedBeforeState = moveReportBuilderDocumentBlockRelativeState(initialState, "headlineKpi", "narrativeIntro", "before");
assert.deepEqual(movedBeforeState.reportDocumentLayout.items, [
    { blockId: "headlineKpi" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro" },
]);

const movedAfterState = moveReportBuilderDocumentBlockRelativeState(initialState, "narrativeIntro", "headlineKpi", "after");
assert.deepEqual(movedAfterState.reportDocumentLayout.items, [
    { blockId: "headlineKpi" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro" },
]);

const resizedHalfWidthState = resizeReportBuilderDocumentBlockState(initialState, "narrativeIntro", "half");
assert.deepEqual(resizedHalfWidthState.reportDocumentLayout.items, [
    { blockId: "narrativeIntro", span: 6 },
    { blockId: "primaryBuilder" },
    { blockId: "headlineKpi" },
]);

const resizedFullWidthState = resizeReportBuilderDocumentBlockState(resizedHalfWidthState, "narrativeIntro", "full");
assert.deepEqual(resizedFullWidthState.reportDocumentLayout.items, [
    { blockId: "narrativeIntro" },
    { blockId: "primaryBuilder" },
    { blockId: "headlineKpi" },
]);

const movedHalfWidthState = moveReportBuilderDocumentBlockState(resizedHalfWidthState, "headlineKpi", "up");
assert.deepEqual(movedHalfWidthState.reportDocumentLayout.items, [
    { blockId: "headlineKpi" },
    { blockId: "primaryBuilder" },
    { blockId: "narrativeIntro", span: 6 },
]);

const removedState = removeReportBuilderDocumentBlockState(initialState, "narrativeIntro");
assert.deepEqual(removedState.reportDocumentBlocks, [
    {
        id: "headlineKpi",
        kind: "kpiBlock",
        title: "Headline KPI",
        datasetRef: "primary",
        valueField: "avails",
        valueLabel: "Avails",
    },
]);
assert.deepEqual(removedState.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
});

const duplicatedMarkdownState = duplicateReportBuilderDocumentBlockState(initialState, "narrativeIntro");
assert.equal(duplicatedMarkdownState.valid, true);
assert.deepEqual(duplicatedMarkdownState.block, {
    id: "narrativeIntroCopy",
    kind: "markdownBlock",
    title: "Narrative Copy",
    markdown: "## Narrative\nAuthored context.",
});
assert.deepEqual(
    resolveReportBuilderDocumentBlockList(duplicatedMarkdownState.nextState).map((block) => block.id),
    ["narrativeIntro", "narrativeIntroCopy", "headlineKpi"],
);
assert.deepEqual(duplicatedMarkdownState.nextState.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "narrativeIntroCopy" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
});

const duplicatedHalfWidthMarkdownState = duplicateReportBuilderDocumentBlockState(resizedHalfWidthState, "narrativeIntro");
assert.equal(duplicatedHalfWidthMarkdownState.valid, true);
assert.deepEqual(duplicatedHalfWidthMarkdownState.nextState.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "narrativeIntro", span: 6 },
        { blockId: "narrativeIntroCopy", span: 6 },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
});

const duplicatedFilterBarState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "scopeFilters",
            kind: "filterBarBlock",
            title: "Filters",
            paramIds: ["dateRange"],
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "scopeFilters" },
            { blockId: "primaryBuilder" },
        ],
    },
}, "scopeFilters");
assert.equal(duplicatedFilterBarState.valid, true);
assert.deepEqual(duplicatedFilterBarState.block, {
    id: "scopeFiltersCopy",
    kind: "filterBarBlock",
    title: "Filters Copy",
    datasetRef: "primary",
    paramIds: ["dateRange"],
});
const duplicatedRefinementBarState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "trail",
            kind: "refinementBarBlock",
            title: "Active Trail",
            actionKinds: ["remove", "clearAll"],
            emptyLabel: "No drill path selected",
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "trail" },
            { blockId: "primaryBuilder" },
        ],
    },
}, "trail");
assert.equal(duplicatedRefinementBarState.valid, true);
assert.deepEqual(duplicatedRefinementBarState.block, {
    id: "trailCopy",
    kind: "refinementBarBlock",
    title: "Active Trail Copy",
    actionKinds: ["remove", "clearAll"],
    emptyLabel: "No drill path selected",
});
const duplicatedGeoMapState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "stateGeo",
            kind: "geoMapBlock",
            title: "State Geo",
            datasetRef: "primary",
            geo: {
                shape: "us-states",
                key: "country",
                metric: {
                    key: "avails",
                    label: "Avails",
                    format: "compact",
                },
                aggregate: "sum",
            },
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "stateGeo" },
            { blockId: "primaryBuilder" },
        ],
    },
}, "stateGeo");
assert.equal(duplicatedGeoMapState.valid, true);
assert.deepEqual(duplicatedGeoMapState.block, {
    id: "stateGeoCopy",
    kind: "geoMapBlock",
    title: "State Geo Copy",
    datasetRef: "primary",
    geo: {
        shape: "us-states",
        key: "country",
        metric: {
            key: "avails",
            label: "Avails",
            format: "compact",
        },
        aggregate: "sum",
    },
});
const duplicatedChartState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "trendChart",
            kind: "chartBlock",
            title: "Trend Chart",
            datasetRef: "primary",
            chartSpec: {
                title: "Trend Chart",
                type: "line",
                xField: "eventDate",
                yFields: ["avails"],
            },
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "trendChart" },
            { blockId: "primaryBuilder" },
        ],
    },
}, "trendChart");
assert.equal(duplicatedChartState.valid, true);
assert.deepEqual(duplicatedChartState.block, {
    id: "trendChartCopy",
    kind: "chartBlock",
    title: "Trend Chart Copy",
    datasetRef: "primary",
    chartSpec: {
        title: "Trend Chart Copy",
        type: "line",
        xField: "eventDate",
        yFields: ["avails"],
    },
});
const duplicatedKpiState = duplicateReportBuilderDocumentBlockState(initialState, "headlineKpi");
assert.equal(duplicatedKpiState.valid, true);
assert.deepEqual(duplicatedKpiState.block, {
    id: "headlineKpiCopy",
    kind: "kpiBlock",
    title: "Headline KPI Copy",
    datasetRef: "primary",
    valueField: "avails",
    valueLabel: "Avails",
});
assert.deepEqual(
    resolveReportBuilderDocumentBlockList(duplicatedKpiState.nextState).map((block) => block.id),
    ["narrativeIntro", "headlineKpi", "headlineKpiCopy"],
);
assert.deepEqual(duplicatedKpiState.nextState.reportDocumentLayout, {
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
        { blockId: "headlineKpiCopy" },
    ],
});
const duplicatedTableState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "comparisonTable",
            kind: "tableBlock",
            title: "Comparison Table",
            datasetRef: "primary",
            columns: [
                { key: "eventDate", label: "Event Date", format: "date" },
                { key: "avails", label: "Avails", format: "compactNumber" },
            ],
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "primaryBuilder" },
            { blockId: "comparisonTable" },
        ],
    },
}, "comparisonTable");
assert.equal(duplicatedTableState.valid, true);
assert.deepEqual(duplicatedTableState.block, {
    id: "comparisonTableCopy",
    kind: "tableBlock",
    title: "Comparison Table Copy",
    datasetRef: "primary",
    columns: [
        { key: "eventDate", label: "Event Date", format: "date" },
        { key: "avails", label: "Avails", format: "compactNumber" },
    ],
});
assert.deepEqual(duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "stateGeo",
            kind: "geoMapBlock",
            title: "State Geo",
            datasetRef: "primary",
            geo: {},
        },
    ],
    reportDocumentLayout: {
        type: "stack",
        items: [
            { blockId: "primaryBuilder" },
            { blockId: "stateGeo" },
        ],
    },
}, "missingGeo"), {
    valid: false,
    nextState: {
        reportDocumentBlocks: [
            {
                id: "stateGeo",
                kind: "geoMapBlock",
                title: "State Geo",
                datasetRef: "primary",
                geo: {},
            },
        ],
        reportDocumentLayout: {
            type: "stack",
            items: [
                { blockId: "primaryBuilder" },
                { blockId: "stateGeo" },
            ],
        },
    },
    block: null,
});

console.log("reportBuilderDocumentBlocks ✓ manages authored builder block drafts, ordering, and persistence state");
