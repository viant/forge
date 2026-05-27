import assert from "node:assert/strict";

import {
    applyReportBuilderComputedMeasures,
    buildDefaultReportBuilderChartSpec,
    buildReportBuilderColumns,
    buildExplicitReportBuilderChartContainer,
    buildReportBuilderChartFields,
    buildReportBuilderDefaultState,
    buildReportBuilderDefaultChartSpecs,
    buildReportBuilderRequest,
    getReportBuilderResultPanePosition,
    buildReportBuilderSettingsHash,
    canAutoFetchReportBuilder,
    getSelectableReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getVisibleReportBuilderDimensions,
    isExplicitReportBuilderChartMode,
    isReportBuilderChartSpecStale,
    mergeReportBuilderState,
    normalizeReportBuilderChartSpec,
    projectLookupSelection,
    projectLookupSelections,
    projectManualSelection,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

const config = {
    measures: [
        { id: "totalSpend", paramPath: "measures.totalSpend", default: true },
        { id: "impressions", paramPath: "measures.impressions" },
        { id: "clicks", paramPath: "measures.clicks" },
        { id: "dailyPacingBehind", paramPath: "measures.dailyPacingBehind", hidden: true },
    ],
    computedMeasures: [
        {
            id: "ctr",
            key: "ctr",
            dependencies: ["clicks", "impressions"],
            compute: {
                type: "ratio",
                numerator: "clicks",
                denominator: "impressions",
                scale: 100,
                decimals: 2,
            },
        },
    ],
    dimensions: [
        { id: "eventDate", paramPath: "dimensions.eventDate", default: true, chartAxis: true },
        { id: "channelId", paramPath: "dimensions.channelId" },
        { id: "siteType", paramPath: "dimensions.siteType", default: true },
        { id: "internalAgencyId", paramPath: "dimensions.internalAgencyId", hidden: true },
    ],
    groupBy: {
        default: "channelId",
        options: [
            { value: "channelId", label: "Channel", dimensionId: "channelId" },
            { value: "siteType", label: "Site Type", dimensionId: "siteType" },
        ],
    },
    staticFilters: [
        {
            id: "channelIds",
            multiple: true,
            paramPath: "filters.channelIds",
            options: [
                { value: 1, label: "Display", default: true },
                { value: 2, label: "CTV" },
            ],
        },
        {
            id: "dateRange",
            type: "dateRange",
            required: true,
            startParamPath: "filters.From",
            endParamPath: "filters.To",
            default: { start: "2026-04-01", end: "2026-04-30" },
        },
    ],
    dynamicFilterGroups: [
        {
            id: "scope",
            filters: [
                {
                    id: "orderIds",
                    paramPath: "filters.orderIds",
                    multiple: true,
                    manualValueType: "int",
                    valueSelector: "adOrderId",
                    labelSelector: "adOrderName",
                    recordSelectors: ["agencyId", "advertiserId", "campaignId"],
                },
            ],
        },
    ],
    result: {
        pageSize: 50,
        orderFields: [
            { value: "eventDate", field: "eventDate", default: true, defaultDirection: "asc" },
            { value: "totalSpend", field: "totalSpend", defaultDirection: "desc" },
        ],
    },
    request: {
        timeoutMs: 120000,
        baseParameters: {
            filters: {
                agencyId: 42,
            },
        },
    },
};

const defaults = buildReportBuilderDefaultState(config);
assert.deepEqual(defaults.selectedMeasures, ["totalSpend"]);
assert.deepEqual(defaults.selectedDimensions.sort(), ["eventDate", "siteType"].sort());
assert.equal(defaults.groupBy, "channelId");
assert.deepEqual(defaults.staticFilters.channelIds, [1]);
assert.deepEqual(defaults.staticFilters.dateRange, { start: "2026-04-01", end: "2026-04-30" });
assert.equal(defaults.page, 1);
assert.equal(defaults.pageSize, 50);
assert.equal(defaults.orderField, "eventDate");
assert.equal(defaults.orderDir, "asc");
assert.deepEqual(
    getSelectableReportBuilderMeasures(config).map((entry) => entry.id),
    ["totalSpend", "impressions", "clicks", "ctr"],
);
assert.deepEqual(
    getVisibleReportBuilderDimensions(config).map((entry) => entry.id),
    ["eventDate", "channelId", "siteType"],
);

const relativeDefaults = buildReportBuilderDefaultState({
    staticFilters: [
        {
            id: "dateRange",
            type: "dateRange",
            default: { preset: "last7Days" },
        },
    ],
});
assert.match(relativeDefaults.staticFilters.dateRange.start, /^\d{4}-\d{2}-\d{2}$/);
assert.match(relativeDefaults.staticFilters.dateRange.end, /^\d{4}-\d{2}-\d{2}$/);

const relativeDefaultsLast3 = buildReportBuilderDefaultState({
    staticFilters: [
        {
            id: "dateRange",
            type: "dateRange",
            default: { preset: "last3Days" },
        },
    ],
});
assert.match(relativeDefaultsLast3.staticFilters.dateRange.start, /^\d{4}-\d{2}-\d{2}$/);
assert.match(relativeDefaultsLast3.staticFilters.dateRange.end, /^\d{4}-\d{2}-\d{2}$/);
const startLast3 = new Date(relativeDefaultsLast3.staticFilters.dateRange.start);
const endLast3 = new Date(relativeDefaultsLast3.staticFilters.dateRange.end);
assert.equal(Math.round((endLast3 - startLast3) / 86400000), 2);

assert.equal(isExplicitReportBuilderChartMode(config), false);
assert.deepEqual(getReportBuilderSupportedChartTypes(config), ["line", "bar", "area"]);
assert.equal(getReportBuilderResultPanePosition(config), "right");

const explicitChartConfig = {
    ...config,
    result: {
        ...config.result,
        chartCreationMode: "explicit",
        resultPanePosition: "left",
        chartWizard: {
            supportedTypes: ["line", "bar", "area"],
        },
        defaultChartSpecs: [
            {
                title: "Spend by Date",
                type: "line",
                xField: "eventDate",
                yFields: ["totalSpend"],
                seriesField: "siteType",
            },
        ],
    },
};
assert.equal(isExplicitReportBuilderChartMode(explicitChartConfig), true);
assert.equal(getReportBuilderResultPanePosition(explicitChartConfig), "left");

const merged = mergeReportBuilderState(config, {
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
    selectedDimensions: ["eventDate"],
    page: 3,
    pageSize: 25,
    orderField: "totalSpend",
    orderDir: "desc",
    staticFilters: {
        channelIds: [1, 2],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
    dynamicGroups: {
        scope: [
            {
                id: "row_1",
                filterId: "orderIds",
                selections: [{ value: 2667545, label: "Order 2667545" }],
            },
        ],
    },
});

const request = buildReportBuilderRequest(config, merged);
assert.equal(request.measures.totalSpend, true);
assert.equal(request.measures.impressions, true);
assert.equal(request.dimensions.eventDate, true);
assert.equal(request.dimensions.channelId, true);
assert.deepEqual(request.filters.channelIds, [1, 2]);
assert.equal(request.filters.From, "2026-05-01");
assert.equal(request.filters.To, "2026-05-31");
assert.deepEqual(request.filters.orderIds, [2667545]);
assert.equal(request.filters.agencyId, 42);
assert.equal(request.limit, 25);
assert.equal(request.offset, 50);
assert.equal(request.timeoutMs, 120000);
assert.deepEqual(request.orderBy, ["totalSpend desc"]);
assert.equal(canAutoFetchReportBuilder(config, merged), true);
assert.deepEqual(resolveReportBuilderReadiness(config, merged), { canRun: true, reason: "" });

const disabledDynamicRowState = mergeReportBuilderState(config, {
    selectedMeasures: ["totalSpend"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
    dynamicGroups: {
        scope: [
            {
                id: "row_1",
                filterId: "orderIds",
                enabled: false,
                selections: [{ value: 2667545, label: "Order 2667545" }],
            },
        ],
    },
});
const disabledDynamicRowRequest = buildReportBuilderRequest(config, disabledDynamicRowState);
assert.equal(disabledDynamicRowRequest.filters.orderIds, undefined);
assert.equal(disabledDynamicRowState.dynamicGroups.scope[0].enabled, false);

const computedOnlyState = mergeReportBuilderState(config, {
    selectedMeasures: ["ctr"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
});
const computedOnlyRequest = buildReportBuilderRequest(config, computedOnlyState);
assert.equal(computedOnlyRequest.measures.clicks, true);
assert.equal(computedOnlyRequest.measures.impressions, true);
assert.equal(computedOnlyRequest.measures.ctr, undefined);
assert.deepEqual(
    applyReportBuilderComputedMeasures([
        { eventDate: "2026-05-01", clicks: 25, impressions: 1000 },
        { eventDate: "2026-05-02", clicks: 0, impressions: 0 },
    ], config),
    [
        { eventDate: "2026-05-01", clicks: 25, impressions: 1000, ctr: 2.5 },
        { eventDate: "2026-05-02", clicks: 0, impressions: 0, ctr: 0 },
    ],
);

const missingDate = mergeReportBuilderState(config, {
    selectedMeasures: ["totalSpend"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "", end: "" },
    },
});
assert.equal(canAutoFetchReportBuilder(config, missingDate), false);
assert.deepEqual(resolveReportBuilderReadiness(config, missingDate), { canRun: false, reason: "requiredFilter" });

const missingScope = mergeReportBuilderState(config, {
    selectedMeasures: ["totalSpend"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
    dynamicGroups: {
        scope: [],
    },
});
const scopeFreeConfig = {
    ...config,
    request: {
        ...config.request,
        baseParameters: {},
    },
};
assert.equal(canAutoFetchReportBuilder(scopeFreeConfig, missingScope), true);
assert.deepEqual(resolveReportBuilderReadiness(scopeFreeConfig, missingScope), { canRun: true, reason: "" });

const chartFields = buildReportBuilderChartFields(config, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
});
assert.deepEqual(chartFields, [
    { key: "eventDate", aliases: ["eventDate"], label: "eventDate", kind: "dimension", format: undefined, align: undefined },
    { key: "siteType", aliases: ["siteType"], label: "siteType", kind: "dimension", format: undefined, align: undefined },
    { key: "totalSpend", aliases: ["totalSpend"], label: "totalSpend", kind: "measure", format: undefined, align: "right" },
    { key: "impressions", aliases: ["impressions"], label: "impressions", kind: "measure", format: undefined, align: "right" },
]);

const normalizedChartSpec = normalizeReportBuilderChartSpec({
    title: "Spend by Date",
    type: "LINE",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "siteType",
});
assert.deepEqual(normalizedChartSpec, {
    title: "Spend by Date",
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "siteType",
});

const validChartSpec = validateReportBuilderChartSpec(config, normalizedChartSpec, chartFields);
assert.deepEqual(validChartSpec, { valid: true, errors: [] });

const invalidChartSpec = validateReportBuilderChartSpec(config, {
    type: "line",
    xField: "totalSpend",
    yFields: ["missingMeasure"],
    seriesField: "totalSpend",
}, chartFields);
assert.deepEqual(invalidChartSpec, {
    valid: false,
    errors: [
        { field: "xField", code: "wrongKind" },
        { field: "yFields.0", code: "missingField" },
        { field: "seriesField", code: "wrongKind" },
        { field: "seriesField", code: "duplicateField" },
    ],
});

assert.equal(
    isReportBuilderChartSpecStale(config, normalizedChartSpec, buildReportBuilderChartFields(config, {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["totalSpend"],
    })),
    true,
);

const defaultChartSpec = buildDefaultReportBuilderChartSpec(config, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
});
assert.deepEqual(defaultChartSpec, {
    type: "line",
    xField: "eventDate",
    yFields: ["impressions"],
    seriesField: "siteType",
});

assert.deepEqual(
    buildReportBuilderDefaultChartSpecs(explicitChartConfig, {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend", "impressions"],
        primaryMeasure: "totalSpend",
    }),
    [
        {
            title: "Spend by Date",
            type: "line",
            xField: "eventDate",
            yFields: ["totalSpend"],
            seriesField: "siteType",
        },
    ],
);

const settingsHashA = buildReportBuilderSettingsHash({
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
});
const settingsHashB = buildReportBuilderSettingsHash({
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
});
const settingsHashC = buildReportBuilderSettingsHash({
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
});
assert.equal(settingsHashA, settingsHashB);
assert.notEqual(settingsHashA, settingsHashC);

const explicitDefaults = buildReportBuilderDefaultState(explicitChartConfig);
assert.equal(explicitDefaults.viewMode, "table");

const explicitMergedNoChart = mergeReportBuilderState(explicitChartConfig, {
    viewMode: "chart",
    chartSpec: null,
});
assert.equal(explicitMergedNoChart.viewMode, "table");

const explicitSanitizedMissingField = sanitizeReportBuilderState(explicitChartConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: {
        type: "line",
        xField: "eventDate",
        yFields: ["unknownMetric"],
        seriesField: "siteType",
    },
    viewMode: "chart",
});
assert.equal(explicitSanitizedMissingField.chartSpec, null);
assert.equal(explicitSanitizedMissingField.viewMode, "table");

const explicitContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    config,
    {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend", "impressions"],
    },
    {
        type: "bar",
        xField: "eventDate",
        yFields: ["totalSpend"],
        seriesField: "siteType",
    },
);
assert.equal(explicitContainer.chart.type, "bar");
assert.equal(explicitContainer.chart.xAxis.dataKey, "eventDate");
assert.equal(explicitContainer.chart.series.nameKey, "siteType");
assert.equal(explicitContainer.chart.series.valueKey, "totalSpend");

const displayConfig = {
    ...config,
    dimensions: [
        { id: "channelId", key: "channelId", displayKey: "channel.channel", paramPath: "dimensions.channelId", default: true },
        { id: "eventDate", key: "eventDate", paramPath: "dimensions.eventDate", chartAxis: true },
    ],
};
assert.deepEqual(
    buildReportBuilderColumns(displayConfig, {
        selectedDimensions: ["channelId", "eventDate"],
        selectedMeasures: ["totalSpend"],
    }),
    [
        {
            key: "channelId",
            sourceKey: "channelId",
            displayKey: "channel.channel",
            chartKey: "channel.channel",
            label: "channelId",
            kind: "dimension",
            format: undefined,
        },
        {
            key: "eventDate",
            sourceKey: "eventDate",
            displayKey: "eventDate",
            chartKey: "eventDate",
            label: "eventDate",
            kind: "dimension",
            format: undefined,
        },
        {
            key: "totalSpend",
            label: "totalSpend",
            kind: "measure",
            format: undefined,
            align: "right",
        },
    ],
);
assert.deepEqual(
    buildReportBuilderChartFields(displayConfig, {
        selectedDimensions: ["channelId", "eventDate"],
        selectedMeasures: ["totalSpend"],
    }),
    [
        { key: "channel.channel", aliases: ["channelId"], label: "channelId", kind: "dimension", format: undefined, align: undefined },
        { key: "eventDate", aliases: ["eventDate"], label: "eventDate", kind: "dimension", format: undefined, align: undefined },
        { key: "totalSpend", aliases: ["totalSpend"], label: "totalSpend", kind: "measure", format: undefined, align: "right" },
    ],
);
const displayChartSpec = buildDefaultReportBuilderChartSpec(displayConfig, {
    selectedDimensions: ["channelId", "eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
});
assert.equal(displayChartSpec.xField, "channel.channel");
const displayContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    displayConfig,
    {
        selectedDimensions: ["channelId", "eventDate"],
        selectedMeasures: ["totalSpend"],
    },
    {
        type: "bar",
        xField: "channelId",
        yFields: ["totalSpend"],
    },
);
assert.equal(displayContainer.chart.xAxis.dataKey, "channel.channel");

const familyDraftConfig = {
    dynamicFilterGroups: [
        {
            id: "include",
            filters: [
                { id: "includePublisherId" },
                { id: "includeCarrier" },
            ],
        },
    ],
};
const familyDraftState = sanitizeReportBuilderState(familyDraftConfig, {
    dynamicGroups: {
        include: [
            { id: "row_a", filterId: "includePublisherId", selections: [] },
            { id: "row_b", filterId: "includeCarrier", selections: [] },
            { id: "row_c", filterId: "includeCarrier", selections: [] },
        ],
    },
});
assert.deepEqual(
    familyDraftState.dynamicGroups.include.map((row) => row.id),
    ["row_a", "row_b", "row_c"],
);

const singleSelectArrayConfig = {
    ...config,
    dynamicFilterGroups: [
        {
            id: "scope",
            filters: [
                {
                    id: "orderIds",
                    paramPath: "filters.orderIds",
                    multiple: false,
                    emitArray: true,
                    manualValueType: "int",
                    valueSelector: "adOrderId",
                    labelSelector: "adOrderName",
                },
            ],
        },
    ],
    request: {
        ...config.request,
        baseParameters: {
            filters: {},
        },
    },
};
const singleSelectArrayState = mergeReportBuilderState(singleSelectArrayConfig, {
    selectedMeasures: ["totalSpend"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
    dynamicGroups: {
        scope: [
            {
                id: "row_1",
                filterId: "orderIds",
                selections: [{
                    value: 2609393,
                    label: "Order 2609393",
                    record: {
                        adOrderId: 2609393,
                        adOrderName: "Order 2609393",
                        agencyId: 1162,
                    },
                }],
            },
        ],
    },
});
const singleSelectArrayRequest = buildReportBuilderRequest(singleSelectArrayConfig, singleSelectArrayState);
assert.deepEqual(singleSelectArrayRequest.filters.orderIds, [2609393]);

const hookOwnedTargetingConfig = {
    ...config,
    request: {
        ...config.request,
        baseParameters: {
            filters: {},
        },
    },
    dynamicFilterGroups: [
        {
            id: "targeting",
            filters: [
                {
                    id: "irisSegmentIds",
                    paramPath: "filters.targetingIncl",
                    multiple: false,
                    emitArray: true,
                    requestMapping: "hook",
                    valueSelector: "value",
                    labelSelector: "label",
                },
            ],
        },
    ],
};
const hookOwnedTargetingState = mergeReportBuilderState(hookOwnedTargetingConfig, {
    selectedMeasures: ["totalSpend"],
    staticFilters: {
        channelIds: [1],
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
    dynamicGroups: {
        targeting: [
            {
                id: "row_1",
                filterId: "irisSegmentIds",
                selections: [{ value: "iris-123", label: "IRIS 123" }],
            },
        ],
    },
});
const hookOwnedTargetingRequest = buildReportBuilderRequest(hookOwnedTargetingConfig, hookOwnedTargetingState);
assert.equal(hookOwnedTargetingRequest.filters.targetingIncl, undefined);

const projected = projectLookupSelection(
    {
        valueSelector: "node.id",
        labelSelector: "node.label",
        groupSelector: "category",
    },
    {
        category: "Inventory",
        node: {
            id: 31312,
            label: "Sports Fans",
        },
    },
);
assert.deepEqual(projected, {
    value: 31312,
    label: "Sports Fans",
    group: "Inventory",
    record: {
        "node.id": 31312,
        "node.label": "Sports Fans",
        category: "Inventory",
    },
});

const projectedMany = projectLookupSelections(
    {
        valueSelector: "adOrderId",
        labelSelector: "adOrderName",
    },
    [
        { adOrderId: 101, adOrderName: "Order 101" },
        { adOrderId: 202, adOrderName: "Order 202" },
    ],
);
assert.deepEqual(projectedMany, [
    {
        value: 101,
        label: "Order 101",
        group: "",
        record: { adOrderId: 101, adOrderName: "Order 101" },
    },
    {
        value: 202,
        label: "Order 202",
        group: "",
        record: { adOrderId: 202, adOrderName: "Order 202" },
    },
]);

assert.deepEqual(
    projectManualSelection(
        {
            valueSelector: "dealId",
            labelSelector: "dealName",
            manualValueType: "int",
        },
        "141952",
    ),
    {
        value: 141952,
        label: "141952",
        group: "",
        record: {
            dealId: 141952,
            dealName: "141952",
        },
    },
);
assert.equal(
    projectManualSelection(
        {
            valueSelector: "dealId",
            labelSelector: "dealName",
            manualValueType: "int",
        },
        "deal-xyz",
    ),
    null,
);

const compactProjected = projectLookupSelection(
    {
        valueSelector: "adOrderId",
        labelSelector: "adOrderName",
        recordSelectors: ["agencyId", "advertiserId", "campaignId"],
    },
    {
        adOrderId: 2609393,
        adOrderName: "CTV_Chicago_Weekdays",
        advertiserId: 71582,
        advertiserName: "City of Hope",
        agencyId: 1162,
        agencyName: "Merkle",
        campaignId: 537454,
        campaignName: "FY26_CAP_NorthRegion_ALL",
        giant: {
            deep: {
                value: "should not persist",
            },
        },
    },
);
assert.deepEqual(compactProjected, {
    value: 2609393,
    label: "CTV_Chicago_Weekdays",
    group: "",
    record: {
        adOrderId: 2609393,
        adOrderName: "CTV_Chicago_Weekdays",
        agencyId: 1162,
        advertiserId: 71582,
        campaignId: 537454,
    },
});

const duplicateDraftState = mergeReportBuilderState(config, {
    dynamicGroups: {
        scope: [
            { id: "row_1", filterId: "orderIds", selections: [] },
            { id: "row_2", filterId: "orderIds", selections: [] },
            {
                id: "row_3",
                filterId: "orderIds",
                selections: [{
                    value: 2609393,
                    label: "Order 2609393",
                    record: {
                        adOrderId: 2609393,
                        adOrderName: "Order 2609393",
                    },
                }],
            },
        ],
    },
});
assert.deepEqual(duplicateDraftState.dynamicGroups.scope, [
    {
        id: "row_1",
        filterId: "orderIds",
        enabled: true,
        selections: [],
    },
    {
        id: "row_2",
        filterId: "orderIds",
        enabled: true,
        selections: [],
    },
    {
        id: "row_3",
        filterId: "orderIds",
        enabled: true,
        selections: [{
            value: 2609393,
            label: "Order 2609393",
            group: "",
            record: {
                adOrderId: 2609393,
                adOrderName: "Order 2609393",
            },
        }],
    },
]);

const sanitizedDrafts = sanitizeReportBuilderState(config, {
    dynamicGroups: {
        scope: [
            { id: "row_1", filterId: "orderIds", selections: [] },
            { id: "row_2", filterId: "orderIds", selections: [] },
        ],
    },
});
assert.deepEqual(sanitizedDrafts.dynamicGroups.scope, [
    {
        id: "row_1",
        filterId: "orderIds",
        enabled: true,
        selections: [],
    },
    {
        id: "row_2",
        filterId: "orderIds",
        enabled: true,
        selections: [],
    },
]);

const sanitizedDisabledRows = sanitizeReportBuilderState(config, {
    dynamicGroups: {
        scope: [
            { id: "row_1", filterId: "orderIds", enabled: false, selections: [{ value: 8, label: "Eight" }] },
        ],
    },
});
assert.equal(sanitizedDisabledRows.dynamicGroups.scope[0].enabled, false);

const sanitizedInvalidManualId = sanitizeReportBuilderState(config, {
    dynamicGroups: {
        scope: [
            { id: "row_bad", filterId: "orderIds", selections: [{ value: "[MaxDepth]", label: "[MaxDepth]" }] },
            {
                id: "row_good",
                filterId: "orderIds",
                selections: [{
                    value: "2661308",
                    label: "Order 2661308",
                    record: {
                        adOrderId: 2661308,
                        adOrderName: "Order 2661308",
                    },
                }],
            },
        ],
    },
});
assert.deepEqual(sanitizedInvalidManualId.dynamicGroups.scope, [
    {
        id: "row_good",
        filterId: "orderIds",
        enabled: true,
        selections: [
            {
                value: 2661308,
                label: "Order 2661308",
                group: "",
                record: {
                    adOrderId: 2661308,
                    adOrderName: "Order 2661308",
                },
            },
        ],
    },
]);

console.log("reportBuilderUtils ✓ request mapping, defaults, and lookup projection");
