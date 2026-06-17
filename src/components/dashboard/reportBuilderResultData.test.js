import assert from "node:assert/strict";

import {
    buildReportBuilderChartQueryRequest,
    getReportBuilderChartDataPolicy,
    resolveReportBuilderChartCollection,
    resolveReportBuilderExportCollection,
} from "./reportBuilderResultData.js";

assert.deepEqual(
    getReportBuilderChartDataPolicy({}),
    {
        mode: "currentPage",
        rowLimit: 1000,
    },
);

assert.deepEqual(
    getReportBuilderChartDataPolicy({
        result: {
            chartDataMode: "fullQuery",
            chartRowLimit: 2500,
        },
    }),
    {
        mode: "fullQuery",
        rowLimit: 2500,
    },
);

assert.equal(
    buildReportBuilderChartQueryRequest(
        { limit: 25, offset: 50, filters: { channelIds: [1] } },
        { mode: "currentPage", rowLimit: 500 },
    ),
    null,
);

assert.deepEqual(
    buildReportBuilderChartQueryRequest(
        { limit: 25, offset: 50, filters: { channelIds: [1] } },
        { mode: "fullQuery", rowLimit: 500 },
    ),
    {
        limit: 500,
        offset: 0,
        filters: { channelIds: [1] },
    },
);

assert.deepEqual(
    resolveReportBuilderChartCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [{ value: 2 }],
        policy: { mode: "currentPage" },
    }),
    [{ value: 1 }],
);

assert.deepEqual(
    resolveReportBuilderChartCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [{ value: 2 }],
        policy: { mode: "fullQuery" },
        chartQueryLoading: false,
    }),
    [{ value: 2 }],
);

assert.deepEqual(
    resolveReportBuilderChartCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [],
        policy: { mode: "fullQuery" },
        chartQueryLoading: true,
    }),
    [{ value: 1 }],
);

assert.deepEqual(
    resolveReportBuilderChartCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [],
        policy: { mode: "fullQuery" },
        chartQueryLoading: false,
    }),
    [],
);

assert.deepEqual(
    resolveReportBuilderExportCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [{ value: 2 }],
        policy: { mode: "fullQuery" },
        showingChartView: false,
    }),
    [{ value: 1 }],
);

assert.deepEqual(
    resolveReportBuilderExportCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [{ value: 2 }],
        policy: { mode: "fullQuery" },
        showingChartView: true,
    }),
    [{ value: 2 }],
);

assert.deepEqual(
    resolveReportBuilderExportCollection({
        computedCollection: [{ value: 1 }],
        chartCollection: [],
        policy: { mode: "fullQuery" },
        showingChartView: true,
    }),
    [{ value: 1 }],
);

console.log("reportBuilderResultData ✓ chart data policy and collection selection");
