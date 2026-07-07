import assert from "node:assert/strict";

import {
    collectChartSeriesDatumSelectionRows,
    collectChartLegendSelectionRows,
    normalizeChartDatumSelection,
    normalizeChartLegendSelection,
    normalizeChartSeriesDatumSelection,
} from "./chartSelectionModel.js";

assert.deepEqual(normalizeChartDatumSelection({
    xAxisDataKey: "eventDate",
    event: {
        activeLabel: "2026-05-01",
        activePayload: [
            {
                dataKey: "avails",
                payload: {
                    eventDate: "2026-05-01",
                    avails: 12000,
                    __chartSelectionRows: [
                        { campaign: "Prospect Sprint" },
                        { campaign: "Family Reach" },
                    ],
                },
            },
        ],
    },
}), {
    source: "cartesian",
    row: {
        eventDate: "2026-05-01",
        avails: 12000,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint" },
            { campaign: "Family Reach" },
        ],
    },
    selectionRows: [
        { campaign: "Prospect Sprint" },
        { campaign: "Family Reach" },
    ],
    xDataKey: "eventDate",
    xValue: "2026-05-01",
    seriesKey: "avails",
});

assert.deepEqual(normalizeChartDatumSelection({
    xAxisDataKey: "name",
    event: {
        name: "Display",
        payload: {
            name: "Display",
            value: 40400,
            __chartSelectionRows: [
                { scopeFilter: "national" },
            ],
        },
    },
}), {
    source: "pie",
    row: {
        name: "Display",
        value: 40400,
        __chartSelectionRows: [
            { scopeFilter: "national" },
        ],
    },
    selectionRows: [
        { scopeFilter: "national" },
    ],
    xDataKey: "name",
    xValue: "Display",
    seriesKey: "Display",
});

assert.equal(normalizeChartDatumSelection({ event: {} }), null);

assert.deepEqual(normalizeChartLegendSelection({
    entry: {
        value: "Display",
        dataKey: "Display",
    },
    selectionRows: [
        { channelV2: 1, channel: { channel: "Display" } },
    ],
}), {
    source: "legend",
    row: null,
    selectionRows: [
        { channelV2: 1, channel: { channel: "Display" } },
    ],
    xDataKey: "",
    xValue: undefined,
    seriesKey: "Display",
});

assert.deepEqual(collectChartLegendSelectionRows([
    {
        eventDate: "2026-05-01",
        totalSpend: 40400,
        impressions: 120000,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint" },
            { campaign: "Family Reach" },
        ],
    },
    {
        eventDate: "2026-05-02",
        totalSpend: 34300,
        impressions: 90000,
        __chartSelectionRows: [
            { campaign: "Launch Burst" },
        ],
    },
], "totalSpend"), [
    { campaign: "Prospect Sprint" },
    { campaign: "Family Reach" },
    { campaign: "Launch Burst" },
]);

assert.deepEqual(collectChartLegendSelectionRows([
    {
        name: "Display",
        value: 40400,
        __chartSelectionRows: [
            { scopeFilter: "national" },
        ],
    },
], "Display"), [
    { scopeFilter: "national" },
]);

assert.deepEqual(collectChartSeriesDatumSelectionRows([
    {
        eventDate: "2026-05-01",
        totalSpend: 40400,
        impressions: 120000,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint", country: "US" },
            { campaign: "Family Reach", country: "US" },
        ],
    },
    {
        eventDate: "2026-05-02",
        totalSpend: 34300,
        impressions: 90000,
        __chartSelectionRows: [
            { campaign: "Launch Burst", country: "CA" },
        ],
    },
], {
    seriesKey: "totalSpend",
    xAxisDataKey: "eventDate",
    xValue: "2026-05-01",
}), [
    { campaign: "Prospect Sprint", country: "US" },
    { campaign: "Family Reach", country: "US" },
]);

assert.deepEqual(collectChartSeriesDatumSelectionRows([
    {
        channel: { channel: "CTV" },
        totalSpend: 40400,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint", country: "US" },
        ],
    },
    {
        channel: { channel: "Audio" },
        totalSpend: 90000,
        __chartSelectionRows: [
            { campaign: "Launch Burst", country: "CA" },
        ],
    },
], {
    seriesKey: "totalSpend",
    xAxisDataKey: "channel.channel",
    xValue: "CTV",
}), [
    { campaign: "Prospect Sprint", country: "US" },
]);

assert.deepEqual(normalizeChartSeriesDatumSelection({
    seriesKey: "Display",
    xAxisDataKey: "eventDate",
    event: {
        payload: {
            eventDate: "2026-05-01",
            Display: 40400,
            CTV: 34300,
            __chartSelectionRows: {
                Display: [{ campaign: "Prospect Sprint" }],
                CTV: [{ campaign: "Family Reach" }],
            },
        },
    },
}), {
    source: "cartesian",
    row: {
        eventDate: "2026-05-01",
        Display: 40400,
        CTV: 34300,
        __chartSelectionRows: {
            Display: [{ campaign: "Prospect Sprint" }],
            CTV: [{ campaign: "Family Reach" }],
        },
    },
    selectionRows: [{ campaign: "Prospect Sprint" }],
    xDataKey: "eventDate",
    xValue: "2026-05-01",
    seriesKey: "Display",
});

assert.deepEqual(normalizeChartSeriesDatumSelection({
    seriesKey: "totalSpend",
    xAxisDataKey: "eventDate",
    chartRows: [
        {
            eventDate: "2026-05-01",
            totalSpend: 40400,
            impressions: 120000,
            __chartSelectionRows: [
                { campaign: "Prospect Sprint", country: "US" },
                { campaign: "Family Reach", country: "US" },
            ],
        },
    ],
    event: {
        payload: {
            eventDate: "2026-05-01",
            totalSpend: 40400,
            impressions: 120000,
        },
    },
}), {
    source: "cartesian",
    row: {
        eventDate: "2026-05-01",
        totalSpend: 40400,
        impressions: 120000,
    },
    selectionRows: [
        { campaign: "Prospect Sprint", country: "US" },
        { campaign: "Family Reach", country: "US" },
    ],
    xDataKey: "eventDate",
    xValue: "2026-05-01",
    seriesKey: "totalSpend",
});

assert.deepEqual(normalizeChartSeriesDatumSelection({
    seriesKey: "totalSpend",
    xAxisDataKey: "eventDate",
    event: {
        payload: {
            eventDate: "2026-05-01",
            totalSpend: 40400,
            impressions: 120000,
            __chartSelectionRows: [
                { campaign: "Prospect Sprint" },
                { campaign: "Family Reach" },
            ],
        },
    },
}), {
    source: "cartesian",
    row: {
        eventDate: "2026-05-01",
        totalSpend: 40400,
        impressions: 120000,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint" },
            { campaign: "Family Reach" },
        ],
    },
    selectionRows: [
        { campaign: "Prospect Sprint" },
        { campaign: "Family Reach" },
    ],
    xDataKey: "eventDate",
    xValue: "2026-05-01",
    seriesKey: "totalSpend",
});

assert.deepEqual(normalizeChartSeriesDatumSelection({
    seriesKey: "totalSpend",
    event: {
        payload: {
            name: "May 1",
            totalSpend: 40400,
            __chartSelectionRows: [
                { campaign: "Prospect Sprint" },
            ],
        },
    },
}), {
    source: "cartesian",
    row: {
        name: "May 1",
        totalSpend: 40400,
        __chartSelectionRows: [
            { campaign: "Prospect Sprint" },
        ],
    },
    selectionRows: [
        { campaign: "Prospect Sprint" },
    ],
    xDataKey: "name",
    xValue: "May 1",
    seriesKey: "totalSpend",
});

assert.deepEqual(normalizeChartDatumSelection({
    xAxisDataKey: "channel.channel",
    event: {
        activePayload: [
            {
                dataKey: "Display",
                payload: {
                    channel: { channel: "Display" },
                    Display: 40400,
                    __chartSelectionRows: {
                        Display: [{ campaign: "Prospect Sprint" }],
                    },
                },
            },
        ],
    },
}), {
    source: "cartesian",
    row: {
        channel: { channel: "Display" },
        Display: 40400,
        __chartSelectionRows: {
            Display: [{ campaign: "Prospect Sprint" }],
        },
    },
    selectionRows: [{ campaign: "Prospect Sprint" }],
    xDataKey: "channel.channel",
    xValue: "Display",
    seriesKey: "Display",
});

assert.deepEqual(normalizeChartSeriesDatumSelection({
    seriesKey: "Display",
    xAxisDataKey: "channel.channel",
    chartRows: [
        {
            channel: { channel: "Display" },
            Display: 40400,
            __chartSelectionRows: {
                Display: [{ campaign: "Prospect Sprint" }],
            },
        },
    ],
    event: {
        payload: {
            channel: { channel: "Display" },
            Display: 40400,
        },
    },
}), {
    source: "cartesian",
    row: {
        channel: { channel: "Display" },
        Display: 40400,
    },
    selectionRows: [{ campaign: "Prospect Sprint" }],
    xDataKey: "channel.channel",
    xValue: "Display",
    seriesKey: "Display",
});

console.log("chartSelectionModel ✓ normalizes chart click events into reusable datum selections");
