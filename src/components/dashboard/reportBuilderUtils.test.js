import assert from "node:assert/strict";

import {
    buildReportBuilderDefaultState,
    buildReportBuilderRequest,
    mergeReportBuilderState,
    projectLookupSelection,
} from "./reportBuilderUtils.js";

const config = {
    measures: [
        { id: "totalSpend", paramPath: "measures.totalSpend", default: true },
        { id: "impressions", paramPath: "measures.impressions" },
    ],
    dimensions: [
        { id: "eventDate", paramPath: "dimensions.eventDate", default: true, chartAxis: true },
        { id: "channelId", paramPath: "dimensions.channelId" },
        { id: "siteType", paramPath: "dimensions.siteType", default: true },
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
        category: "Inventory",
        node: {
            id: 31312,
            label: "Sports Fans",
        },
    },
});

console.log("reportBuilderUtils ✓ request mapping, defaults, and lookup projection");
