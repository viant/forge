import assert from "node:assert/strict";

import {
    applyReportBuilderComputedMeasures,
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    canAutoFetchReportBuilder,
    getSelectableReportBuilderMeasures,
    getVisibleReportBuilderDimensions,
    mergeReportBuilderState,
    projectLookupSelection,
    projectLookupSelections,
    resolveReportBuilderReadiness,
    sanitizeReportBuilderState,
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
                selections: [{ value: 2609393, label: "Order 2609393" }],
            },
        ],
    },
});
assert.deepEqual(duplicateDraftState.dynamicGroups.scope, [
    {
        id: "row_3",
        filterId: "orderIds",
        selections: [{ value: 2609393, label: "Order 2609393", group: "", record: null }],
    },
    {
        id: "row_1",
        filterId: "orderIds",
        selections: [],
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
        selections: [],
    },
]);

console.log("reportBuilderUtils ✓ request mapping, defaults, and lookup projection");
