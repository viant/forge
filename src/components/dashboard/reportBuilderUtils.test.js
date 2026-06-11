import assert from "node:assert/strict";

import {
    applyReportBuilderComputedMeasures,
    buildDefaultReportBuilderChartSpec,
    buildReportBuilderColumns,
    buildExplicitReportBuilderChartContainer,
    buildReportBuilderChartFields,
    buildReportBuilderDefaultState,
    buildReportBuilderDefaultChartSpecs,
    getReportBuilderQuickPresetPolicy,
    buildReportBuilderRequest,
    getReportBuilderResultPanePosition,
    buildReportBuilderSettingsHash,
    canAutoFetchReportBuilder,
    prepareReportBuilderAutoChartApplication,
    getSelectableReportBuilderMeasures,
    getReportBuilderSupportedChartTypes,
    getVisibleReportBuilderDimensions,
    isExplicitReportBuilderChartMode,
    isReportBuilderChartSpecStale,
    mergeReportBuilderState,
    normalizeReportBuilderChartSpec,
    prepareReportBuilderChartApplication,
    projectLookupSelection,
    projectLookupSelections,
    projectManualSelection,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
    shouldAutoCollapseReportBuilderFilters,
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

assert.equal(shouldAutoCollapseReportBuilderFilters({
    canShowResults: true,
    hasCompletedCurrentRun: true,
    manualRunSequence: 1,
    collapsedRunSequence: 0,
}), true);
assert.equal(shouldAutoCollapseReportBuilderFilters({
    canShowResults: true,
    hasCompletedCurrentRun: true,
    manualRunSequence: 1,
    collapsedRunSequence: 1,
}), false);
assert.equal(shouldAutoCollapseReportBuilderFilters({
    canShowResults: false,
    hasCompletedCurrentRun: true,
    manualRunSequence: 2,
    collapsedRunSequence: 1,
}), false);
assert.equal(shouldAutoCollapseReportBuilderFilters({
    canShowResults: true,
    hasCompletedCurrentRun: false,
    manualRunSequence: 2,
    collapsedRunSequence: 1,
}), false);
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
assert.deepEqual(
    getReportBuilderSupportedChartTypes(config),
    ["line", "bar", "area", "pie", "donut", "horizontal_bar", "funnel_bar"],
);
assert.equal(getReportBuilderResultPanePosition(config), "right");

const explicitChartConfig = {
    ...config,
    result: {
        ...config.result,
        chartCreationMode: "explicit",
        resultPanePosition: "left",
        quickPresets: {
            autoProvisionMissingDimensions: true,
        },
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
assert.deepEqual(getReportBuilderQuickPresetPolicy(config), {
    autoProvisionMissingDimensions: false,
    autoFetchOnSelect: false,
    selectionPolicy: "merge",
});
assert.deepEqual(getReportBuilderQuickPresetPolicy(explicitChartConfig), {
    autoProvisionMissingDimensions: true,
    autoFetchOnSelect: false,
    selectionPolicy: "merge",
});

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
});

const suggestedChartSpec = buildDefaultReportBuilderChartSpec(config, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
}, {}, {
    suggestSeriesField: true,
});
assert.deepEqual(suggestedChartSpec, {
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
            group: "",
            selectionPolicy: "",
            title: "Spend by Date",
            type: "line",
            xField: "eventDate",
            yFields: ["totalSpend"],
            seriesField: "siteType",
        },
    ],
);

const groupedDefaultChartSpecs = buildReportBuilderDefaultChartSpecs({
    ...explicitChartConfig,
    result: {
        ...explicitChartConfig.result,
        defaultChartSpecs: [
            {
                title: "Spend by Date",
                group: "Overview",
                type: "line",
                xField: "eventDate",
                yFields: ["totalSpend"],
                seriesField: "siteType",
            },
        ],
    },
}, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
});
assert.equal(groupedDefaultChartSpecs[0].group, "Overview");
assert.equal(groupedDefaultChartSpecs[0].selectionPolicy, "");

const selectionPolicyChartSpecs = buildReportBuilderDefaultChartSpecs({
    ...explicitChartConfig,
    result: {
        ...explicitChartConfig.result,
        defaultChartSpecs: [
            {
                title: "Spend by Date",
                group: "Overview",
                type: "line",
                xField: "eventDate",
                yFields: ["totalSpend"],
                selectionPolicy: "replace",
            },
        ],
    },
}, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
});
assert.equal(selectionPolicyChartSpecs[0].selectionPolicy, "replace");

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
assert.equal(displayChartSpec.seriesField, undefined);
const suggestedDisplayChartSpec = buildDefaultReportBuilderChartSpec(displayConfig, {
    selectedDimensions: ["channelId", "eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
}, {}, {
    suggestSeriesField: true,
});
assert.equal(suggestedDisplayChartSpec.seriesField, "eventDate");
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

const blockedQuickApply = prepareReportBuilderChartApplication(displayConfig, {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
}, {
    type: "donut",
    xField: "channel.channel",
    yFields: ["totalSpend"],
}, {
    autoProvisionMissingDimensions: false,
});
assert.equal(blockedQuickApply.canApply, false);
assert.equal(blockedQuickApply.reason, "missingDimensions");
assert.deepEqual(blockedQuickApply.missingDimensionLabels, ["channelId"]);

const autoProvisionedQuickApply = prepareReportBuilderChartApplication(displayConfig, {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    page: 3,
    staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
}, {
    type: "donut",
    xField: "channel.channel",
    yFields: ["totalSpend"],
}, {
    autoProvisionMissingDimensions: true,
});
assert.equal(autoProvisionedQuickApply.canApply, true);
assert.equal(autoProvisionedQuickApply.reason, "");
assert.deepEqual(autoProvisionedQuickApply.nextState.selectedDimensions, ["eventDate", "channelId"]);
assert.equal(autoProvisionedQuickApply.nextState.page, 1);
assert.equal(autoProvisionedQuickApply.shouldFetch, true);
assert.equal(autoProvisionedQuickApply.requiresManualRun, false);

const manualRunQuickApply = prepareReportBuilderChartApplication({
    ...displayConfig,
    request: {
        autoFetch: false,
    },
}, {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
    staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
}, {
    type: "donut",
    xField: "channel.channel",
    yFields: ["totalSpend"],
}, {
    autoProvisionMissingDimensions: true,
});
assert.equal(manualRunQuickApply.canApply, true);
assert.equal(manualRunQuickApply.shouldFetch, false);
assert.equal(manualRunQuickApply.requiresManualRun, true);

const replaceSelectionQuickApply = prepareReportBuilderChartApplication({
    ...displayConfig,
    request: {
        autoFetch: false,
    },
}, {
    selectedDimensions: ["eventDate", "channelId"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
    staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
}, {
    type: "donut",
    xField: "channel.channel",
    yFields: ["totalSpend"],
}, {
    autoProvisionMissingDimensions: true,
    selectionPolicy: "replace",
});
assert.equal(replaceSelectionQuickApply.canApply, true);
assert.deepEqual(replaceSelectionQuickApply.nextState.selectedDimensions, ["channelId"]);
assert.deepEqual(replaceSelectionQuickApply.nextState.selectedMeasures, ["totalSpend"]);
assert.equal(replaceSelectionQuickApply.nextState.primaryMeasure, "totalSpend");
assert.equal(replaceSelectionQuickApply.selectionPolicy, "replace");
assert.equal(replaceSelectionQuickApply.measureSelectionChanged, true);
assert.equal(replaceSelectionQuickApply.dimensionSelectionChanged, true);
assert.equal(replaceSelectionQuickApply.requiresManualRun, true);

const autoFetchOnSelectQuickApply = prepareReportBuilderChartApplication({
    ...displayConfig,
    request: {
        autoFetch: false,
    },
}, {
    selectedDimensions: ["eventDate", "channelId"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "impressions",
    staticFilters: {
        dateRange: { start: "2026-05-01", end: "2026-05-31" },
    },
}, {
    type: "donut",
    xField: "channel.channel",
    yFields: ["totalSpend"],
}, {
    autoProvisionMissingDimensions: true,
    forceAutoFetch: true,
    selectionPolicy: "replace",
});
assert.equal(autoFetchOnSelectQuickApply.shouldFetch, true);
assert.equal(autoFetchOnSelectQuickApply.requiresManualRun, false);

const autoChartApply = prepareReportBuilderAutoChartApplication({
    ...displayConfig,
    result: {
        ...displayConfig.result,
        autoApplyDefaultChartOnResult: true,
        defaultChartSpecs: [
            {
                title: "Needs channel",
                type: "donut",
                xField: "channel.channel",
                yFields: ["totalSpend"],
            },
            {
                title: "Spend by date",
                type: "line",
                xField: "eventDate",
                yFields: ["totalSpend"],
            },
        ],
    },
}, {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
});
assert.equal(autoChartApply?.normalizedChartSpec?.title, "Spend by date");
assert.equal(autoChartApply?.nextState?.viewMode, "chart");
assert.equal(autoChartApply?.requiresDimensionProvision, false);

const disabledAutoChartApply = prepareReportBuilderAutoChartApplication(displayConfig, {
    selectedDimensions: ["eventDate"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
});
assert.equal(disabledAutoChartApply, null);

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

const publisherProjected = projectLookupSelection(
    {
        valueSelector: "publisherId",
        labelSelector: "publisherName",
        recordSelectors: ["publisherId", "publisherName"],
    },
    {
        id: 48,
        name: "Publisher 48",
    },
);
assert.deepEqual(publisherProjected, {
    value: 48,
    label: "Publisher 48",
    group: "",
    record: null,
});

const metricAliasConfig = {
    request: {
        baseParameters: {
            filters: {},
        },
    },
    staticFilters: [
        {
            id: "dateRange",
            type: "dateRange",
            startParamPath: "filters.From",
            endParamPath: "filters.To",
        },
    ],
    dynamicFilterGroups: [
        {
            id: "scope",
            filters: [
                {
                    id: "campaignIds",
                    paramPath: "filters.campaignIds",
                    multiple: true,
                    emitArray: true,
                },
                {
                    id: "orderIds",
                    paramPath: "filters.orderIds",
                    multiple: true,
                    emitArray: true,
                },
            ],
        },
        {
            id: "inventory",
            filters: [
                {
                    id: "publisherIds",
                    paramPath: "filters.publisherIds",
                    multiple: false,
                    emitArray: true,
                },
            ],
        },
    ],
};
const metricAliasState = {
    staticFilters: {
        dateRange: { start: "2026-05-20", end: "2026-05-26" },
    },
    dynamicGroups: {
        scope: [
            { id: "row_campaign", filterId: "campaignIds", selections: [{ value: 11, label: "Campaign 11" }] },
            { id: "row_order", filterId: "orderIds", selections: [{ value: 22, label: "Order 22" }] },
        ],
        inventory: [
            { id: "row_publisher", filterId: "publisherIds", selections: [{ value: 48, label: "Publisher 48" }] },
        ],
    },
    selectedMeasures: [],
    selectedDimensions: [],
};
const metricAliasRequest = buildReportBuilderRequest(metricAliasConfig, metricAliasState);
assert.deepEqual(metricAliasRequest.filters.From, "2026-05-20");
assert.deepEqual(metricAliasRequest.filters.To, "2026-05-26");
assert.deepEqual(metricAliasRequest.filters.from, "2026-05-20");
assert.deepEqual(metricAliasRequest.filters.to, "2026-05-26");
assert.deepEqual(metricAliasRequest.filters.campaignIds, [11]);
assert.deepEqual(metricAliasRequest.filters.campaign_id, [11]);
assert.deepEqual(metricAliasRequest.filters.orderIds, [22]);
assert.deepEqual(metricAliasRequest.filters.order_id, [22]);
assert.deepEqual(metricAliasRequest.filters.publisherIds, [48]);
assert.deepEqual(metricAliasRequest.filters.publisher_id, [48]);

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

const mixedSelectionShapeState = mergeReportBuilderState(config, {
    dynamicGroups: {
        scope: [
            {
                id: "row_mixed",
                filterId: "orderIds",
                selections: [
                    2609393,
                    { value: "2609400", label: "Order 2609400" },
                    { adOrderId: "2609500", adOrderName: "Order 2609500" },
                ],
            },
        ],
    },
});
assert.deepEqual(
    mixedSelectionShapeState.dynamicGroups.scope[0].selections.map((entry) => ({
        value: entry.value,
        label: entry.label,
    })),
    [
        { value: 2609393, label: "2609393" },
        { value: 2609400, label: "Order 2609400" },
        { value: 2609500, label: "Order 2609500" },
    ],
);
const mixedSelectionShapeRequest = buildReportBuilderRequest(config, mixedSelectionShapeState);
assert.deepEqual(mixedSelectionShapeRequest.filters.orderIds, [2609393, 2609400, 2609500]);

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

// --- Phase 1: chart family expansion ------------------------------------------------------

const expandedSupportedConfig = {
    ...config,
    result: {
        ...config.result,
        chartCreationMode: "explicit",
        chartWizard: {
            supportedTypes: ["line", "bar", "area", "pie", "donut", "horizontal_bar", "funnel_bar"],
        },
    },
};
assert.deepEqual(
    getReportBuilderSupportedChartTypes(expandedSupportedConfig),
    ["line", "bar", "area", "pie", "donut", "horizontal_bar", "funnel_bar"],
);

// backward-compatible normalize: legacy spec without seriesOptions stays unchanged
const legacyNormalize = normalizeReportBuilderChartSpec({
    title: "Legacy",
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend"],
});
assert.deepEqual(legacyNormalize, {
    title: "Legacy",
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend"],
});
assert.equal("seriesOptions" in legacyNormalize, false);

// normalize preserves seriesOptions when present, dropping empty bits
const normalizedWithOptions = normalizeReportBuilderChartSpec({
    title: "Combo",
    type: "BAR",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "BAR", axis: "Left", stackId: " primary " },
        impressions: { type: "line", axis: "right" },
        unused: { axis: "" },
    },
});
assert.deepEqual(normalizedWithOptions, {
    title: "Combo",
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "bar", axis: "left", stackId: "primary" },
        impressions: { type: "line", axis: "right" },
    },
});

const familyFields = buildReportBuilderChartFields(config, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
});

// pie/donut: exactly one measure required, no seriesField
const piePass = validateReportBuilderChartSpec(config, {
    type: "pie",
    xField: "siteType",
    yFields: ["totalSpend"],
}, familyFields);
assert.deepEqual(piePass, { valid: true, errors: [] });

const pieTooManyMeasures = validateReportBuilderChartSpec(config, {
    type: "pie",
    xField: "siteType",
    yFields: ["totalSpend", "impressions"],
}, familyFields);
assert.deepEqual(pieTooManyMeasures.errors, [
    { field: "yFields", code: "tooManyMeasures" },
]);

const donutWithSeriesField = validateReportBuilderChartSpec(config, {
    type: "donut",
    xField: "siteType",
    yFields: ["totalSpend"],
    seriesField: "eventDate",
}, familyFields);
assert.deepEqual(donutWithSeriesField.errors, [
    { field: "seriesField", code: "notAllowed" },
]);

const pieWithSeriesOptions = validateReportBuilderChartSpec(config, {
    type: "pie",
    xField: "siteType",
    yFields: ["totalSpend"],
    seriesOptions: { totalSpend: { type: "bar" } },
}, familyFields);
assert.deepEqual(pieWithSeriesOptions.errors, [
    { field: "seriesOptions", code: "notAllowed" },
]);

// split-by-dimension cartesian: seriesField requires exactly one yField
const splitWithExtraMeasure = validateReportBuilderChartSpec(config, {
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesField: "siteType",
}, familyFields);
assert.deepEqual(splitWithExtraMeasure.errors, [
    { field: "seriesField", code: "tooManyMeasures" },
]);

// multi-measure direct-series with seriesOptions: must validate axis + reject unknown keys
const comboInvalid = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "bar", axis: "left", stackId: "primary" },
        impressions: { type: "line", axis: "center" },
        clicks: { type: "bar" },
    },
}, familyFields);
assert.deepEqual(comboInvalid.errors, [
    { field: "seriesOptions.impressions.axis", code: "invalidAxis" },
    { field: "seriesOptions.clicks", code: "unknownMeasure" },
]);

const comboInvalidType = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "scatter" },
    },
}, familyFields);
assert.deepEqual(comboInvalidType.errors, [
    { field: "seriesOptions.totalSpend.type", code: "invalidType" },
]);

const comboValid = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "bar", axis: "left", stackId: "primary" },
        impressions: { type: "line", axis: "right" },
    },
}, familyFields);
assert.deepEqual(comboValid, { valid: true, errors: [] });

// stack axis conflict
const stackConflict = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { axis: "left", stackId: "primary" },
        impressions: { axis: "right", stackId: "primary" },
    },
}, familyFields);
assert.deepEqual(stackConflict.errors, [
    { field: "seriesOptions.impressions.stackId", code: "axisConflict" },
]);

// reject seriesField plus seriesOptions
const seriesFieldPlusOptions = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "siteType",
    seriesOptions: { totalSpend: { type: "bar" } },
}, familyFields);
assert.deepEqual(seriesFieldPlusOptions.errors, [
    { field: "seriesOptions", code: "notAllowed" },
]);

// sanitize prunes stale seriesOptions keys, keeping the rest of the spec valid
const sanitizedStaleSeriesOptions = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    chartSpec: {
        type: "bar",
        xField: "eventDate",
        yFields: ["totalSpend", "impressions"],
        seriesOptions: {
            totalSpend: { type: "bar", axis: "left", stackId: "primary" },
            impressions: { type: "line", axis: "right" },
            removedMeasure: { type: "line" },
        },
    },
    viewMode: "chart",
});
assert.deepEqual(sanitizedStaleSeriesOptions.chartSpec.seriesOptions, {
    totalSpend: { type: "bar", axis: "left", stackId: "primary" },
    impressions: { type: "line", axis: "right" },
});

// missing yFields still invalidates the spec entirely
const sanitizedMissingYWithSeriesOptions = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: {
        type: "bar",
        xField: "eventDate",
        yFields: ["unknownMeasure"],
        seriesOptions: { totalSpend: { type: "bar" } },
    },
    viewMode: "chart",
});
assert.equal(sanitizedMissingYWithSeriesOptions.chartSpec, null);

// sanitize: cartesian + seriesField + multiple yFields -> seriesField cleared, multi-measure chart preserved
const sanitizedDroppedSeriesField = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    chartSpec: {
        type: "bar",
        xField: "eventDate",
        yFields: ["totalSpend", "impressions"],
        seriesField: "siteType",
    },
    viewMode: "chart",
});
assert.equal(sanitizedDroppedSeriesField.chartSpec.seriesField, undefined);
assert.deepEqual(sanitizedDroppedSeriesField.chartSpec.yFields, ["totalSpend", "impressions"]);

// sanitize: category family + seriesField -> seriesField dropped
const sanitizedCategorySeriesField = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: {
        type: "donut",
        xField: "siteType",
        yFields: ["totalSpend"],
        seriesField: "eventDate",
    },
    viewMode: "chart",
});
assert.equal(sanitizedCategorySeriesField.chartSpec.seriesField, undefined);
assert.equal(sanitizedCategorySeriesField.chartSpec.type, "donut");

// sanitize: seriesField + seriesOptions -> seriesOptions dropped (mutually exclusive)
const sanitizedFieldOverOptions = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: {
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
        seriesField: "siteType",
        seriesOptions: { totalSpend: { type: "bar" } },
    },
    viewMode: "chart",
});
assert.equal(sanitizedFieldOverOptions.chartSpec.seriesField, "siteType");
assert.equal(sanitizedFieldOverOptions.chartSpec.seriesOptions, undefined);

// default pie-family spec seeding: never produces seriesField, single yField even when multiple measures are selected
const defaultPieSpec = buildDefaultReportBuilderChartSpec(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend", "impressions"],
    primaryMeasure: "totalSpend",
}, {
    type: "pie",
});
assert.deepEqual(defaultPieSpec, {
    type: "pie",
    xField: "eventDate",
    yFields: ["totalSpend"],
});

// default donut seeding strips a seeded seriesField
const defaultDonutSpec = buildDefaultReportBuilderChartSpec(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    primaryMeasure: "totalSpend",
}, {
    type: "donut",
    seriesField: "siteType",
});
assert.equal(defaultDonutSpec.seriesField, undefined);
assert.equal(defaultDonutSpec.type, "donut");

// round-trip an explicit pie spec through normalize -> sanitize -> container build
const pieSpec = {
    type: "pie",
    xField: "siteType",
    yFields: ["totalSpend"],
};
const sanitizedPie = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: pieSpec,
    viewMode: "chart",
});
assert.deepEqual(sanitizedPie.chartSpec, {
    type: "pie",
    xField: "siteType",
    yFields: ["totalSpend"],
});
const pieContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    expandedSupportedConfig,
    {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend"],
    },
    sanitizedPie.chartSpec,
);
assert.equal(pieContainer.chart.type, "pie");
assert.equal(pieContainer.chart.series.nameKey, "siteType");
assert.equal(pieContainer.chart.series.valueKey, "totalSpend");
assert.equal("xAxis" in pieContainer.chart, false);
assert.equal("yAxis" in pieContainer.chart, false);
assert.ok(Array.isArray(pieContainer.chart.series.palette) && pieContainer.chart.series.palette.length > 0);

// donut container shape
const donutContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    expandedSupportedConfig,
    {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend"],
    },
    {
        type: "donut",
        xField: "siteType",
        yFields: ["totalSpend"],
    },
);
assert.equal(donutContainer.chart.type, "donut");
assert.equal(donutContainer.chart.series.nameKey, "siteType");
assert.equal(donutContainer.chart.series.valueKey, "totalSpend");

// direct multi-measure container picks distinct default colors when no palette configured
const multiMeasureContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    config,
    {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["totalSpend", "impressions"],
    },
    {
        type: "bar",
        xField: "eventDate",
        yFields: ["totalSpend", "impressions"],
    },
);
assert.equal(multiMeasureContainer.chart.series.values.length, 2);
const multiMeasureColors = multiMeasureContainer.chart.series.values.map((entry) => entry.color);
assert.ok(multiMeasureColors[0] && multiMeasureColors[1]);
assert.notEqual(multiMeasureColors[0], multiMeasureColors[1]);

// direct multi-measure container honors seriesOptions for type/axis/stackId
const comboContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    config,
    {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["totalSpend", "impressions"],
    },
    {
        type: "bar",
        xField: "eventDate",
        yFields: ["totalSpend", "impressions"],
        seriesOptions: {
            totalSpend: { type: "bar", axis: "left", stackId: "primary" },
            impressions: { type: "line", axis: "right" },
        },
    },
);
const comboValues = comboContainer.chart.series.values;
assert.equal(comboValues[0].value, "totalSpend");
assert.equal(comboValues[0].type, "bar");
assert.equal(comboValues[0].axis, "left");
assert.equal(comboValues[0].stackId, "primary");
assert.equal(comboValues[1].value, "impressions");
assert.equal(comboValues[1].type, "line");
assert.equal(comboValues[1].axis, "right");
assert.equal(comboValues[1].stackId, undefined);

// horizontal bar container: same multi-measure series.values shape
const horizontalBarContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    expandedSupportedConfig,
    {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend", "impressions"],
    },
    {
        type: "horizontal_bar",
        xField: "siteType",
        yFields: ["totalSpend", "impressions"],
    },
);
assert.equal(horizontalBarContainer.chart.type, "horizontal_bar");
assert.equal(horizontalBarContainer.chart.series.values.length, 2);
assert.equal(horizontalBarContainer.chart.series.values[0].value, "totalSpend");
assert.equal(horizontalBarContainer.chart.series.values[1].value, "impressions");

const horizontalBarInvalidOptions = validateReportBuilderChartSpec(expandedSupportedConfig, {
    type: "horizontal_bar",
    xField: "siteType",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { axis: "left" },
        impressions: { type: "line" },
    },
}, familyFields);
assert.deepEqual(horizontalBarInvalidOptions.errors, [
    { field: "seriesOptions.totalSpend.axis", code: "notAllowed" },
    { field: "seriesOptions.impressions.type", code: "notAllowed" },
]);

// split-by-dimension container: still emits nameKey + values[] with a single measure
const splitContainer = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    config,
    {
        selectedDimensions: ["eventDate", "siteType"],
        selectedMeasures: ["totalSpend"],
    },
    {
        type: "line",
        xField: "eventDate",
        yFields: ["totalSpend"],
        seriesField: "siteType",
    },
);
assert.equal(splitContainer.chart.series.nameKey, "siteType");
assert.equal(splitContainer.chart.series.valueKey, "totalSpend");
assert.equal(splitContainer.chart.series.values.length, 1);

// old explicit line spec round-trips without losing fields or gaining seriesOptions
const legacyExplicitSpec = {
    type: "line",
    xField: "eventDate",
    yFields: ["totalSpend"],
    seriesField: "siteType",
};
const sanitizedLegacy = sanitizeReportBuilderState(expandedSupportedConfig, {
    selectedDimensions: ["eventDate", "siteType"],
    selectedMeasures: ["totalSpend"],
    chartSpec: legacyExplicitSpec,
    viewMode: "chart",
});
assert.deepEqual(sanitizedLegacy.chartSpec, legacyExplicitSpec);
assert.equal("seriesOptions" in sanitizedLegacy.chartSpec, false);

console.log("reportBuilderUtils ✓ request mapping, defaults, and lookup projection");
