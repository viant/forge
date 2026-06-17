import assert from "node:assert/strict";

import {
    buildReportBuilderDocumentCompileValidation,
    buildReportBuilderDocumentBlockFieldOptions,
    buildReportBuilderDocumentCompileDiagnostics,
    buildReportBuilderDocumentBlockDiagnostics,
    buildReportBuilderDocumentBlockDraft,
    duplicateReportBuilderDocumentBlockState,
    moveReportBuilderDocumentBlockState,
    normalizeReportBuilderDocumentLayoutState,
    removeReportBuilderDocumentBlockState,
    resizeReportBuilderDocumentBlockState,
    resolveReportBuilderDocumentWidthLabels,
    resolveReportBuilderDocumentBlockList,
    summarizeReportBuilderDocumentMarkdown,
    upsertReportBuilderDocumentBlockState,
    validateReportBuilderDocumentBlockDraft,
} from "./reportBuilderDocumentBlocks.js";

const markdownDraft = buildReportBuilderDocumentBlockDraft("markdownBlock");
assert.equal(markdownDraft.kind, "markdownBlock");
assert.equal(markdownDraft.title, "Narrative");
assert.match(markdownDraft.markdown, /^## Narrative/);
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
    isHalfWidth: false,
    currentLabel: "Width: Full",
    actionLabel: "Make Half",
    actionTitle: "Resize block to half width",
});
assert.deepEqual(resolveReportBuilderDocumentWidthLabels("half"), {
    isHalfWidth: true,
    currentLabel: "Width: Half",
    actionLabel: "Make Full",
    actionTitle: "Resize block to full width",
});

const filterBarDraft = buildReportBuilderDocumentBlockDraft("filterBarBlock", null, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range", kind: "dateRange", required: true }],
});
assert.deepEqual(filterBarDraft, {
    kind: "filterBarBlock",
    id: "filterBar",
    title: "Report Scope",
    paramIds: ["dateRange"],
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

const tableDraft = buildReportBuilderDocumentBlockDraft("tableBlock", null, {
    tableColumnOptions: [
        { key: "eventDate", label: "Event Date", format: "date" },
        { key: "channelV2", label: "Channel" },
        { key: "avails", label: "Avails", format: "compactNumber" },
    ],
});
assert.deepEqual(tableDraft, {
    kind: "tableBlock",
    id: "tableBlock",
    title: "Detail Table",
    datasetRef: "primary",
    columnKeys: ["eventDate", "channelV2", "avails"],
    columns: [
        { key: "eventDate", label: "Event Date", format: "date" },
        { key: "channelV2", label: "Channel" },
        { key: "avails", label: "Avails", format: "compactNumber" },
    ],
    columnVisualKinds: {},
    columnVisualRuleTexts: {},
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
            message: "Select at least one shared scope parameter for the filter bar block.",
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
            message: "One or more filter bar parameters are not available in the current builder scope.",
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
            message: "Select at least one column for the table block.",
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
        title: "Report Scope",
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
        message: "Report Scope references unavailable scope parameter 'missingScope'.",
        suggestedFix: "Edit the filter bar block to use one of the current shared scope parameters or remove the authored block.",
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
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
}, authoredBlocks), {
    type: "stack",
    items: [
        { blockId: "narrativeIntro" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
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
            { id: "dateRange", label: "Date Range", type: "dateRange", required: true },
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
        { key: "channelV2", label: "Channel", kind: "dimension" },
        { key: "eventDate", label: "Event Date", kind: "dimension" },
        { key: "hhUniqs", label: "HH Uniques", kind: "measure" },
        { key: "avails", label: "Avails", kind: "measure" },
    ],
    scopeParamOptions: [
        { value: "dateRange", label: "Date Range", kind: "dateRange", required: true },
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
            { id: "dateRange", label: "Date Range", type: "dateRange", required: true },
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

assert.deepEqual(buildReportBuilderDocumentCompileDiagnostics({
    document: {
        version: 1,
        kind: "reportDocument",
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
    title: "Report Scope",
    paramIds: ["dateRange"],
}, {
    scopeParamOptions: [{ value: "dateRange", label: "Date Range" }],
});
assert.equal(addedFilterBarState.valid, true);
assert.deepEqual(addedFilterBarState.block, {
    id: "scopeFilters",
    kind: "filterBarBlock",
    title: "Report Scope",
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
        { key: "eventDate", label: "Event Date", format: "date", kind: "dimension" },
        { key: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
    ],
});
assert.equal(addedTableState.valid, true);
assert.deepEqual(addedTableState.block, {
    id: "comparisonTable",
    kind: "tableBlock",
    title: "Comparison Table",
    datasetRef: "primary",
    columns: [
        { key: "eventDate", label: "Event Date", format: "date" },
        {
            key: "avails",
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
        { key: "channelV2", label: "Channel", kind: "dimension" },
        { key: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
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
        { key: "channelV2", label: "Channel", kind: "dimension" },
        { key: "avails", label: "Avails", format: "compactNumber", kind: "measure" },
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

const resizedHalfWidthState = resizeReportBuilderDocumentBlockState(initialState, "narrativeIntro", "half");
assert.deepEqual(resizedHalfWidthState.reportDocumentLayout.items, [
    { blockId: "narrativeIntro", size: "half" },
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
    { blockId: "narrativeIntro", size: "half" },
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
        { blockId: "narrativeIntro", size: "half" },
        { blockId: "narrativeIntroCopy", size: "half" },
        { blockId: "primaryBuilder" },
        { blockId: "headlineKpi" },
    ],
});

const duplicatedFilterBarState = duplicateReportBuilderDocumentBlockState({
    reportDocumentBlocks: [
        {
            id: "scopeFilters",
            kind: "filterBarBlock",
            title: "Report Scope",
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
    title: "Report Scope Copy",
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
