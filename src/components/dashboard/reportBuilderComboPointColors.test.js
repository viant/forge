import assert from "node:assert/strict";

import {
    buildExplicitReportBuilderChartContainer,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

const config = {
    measures: [
        { id: "profit", key: "profit", label: "Profit", format: "currency" },
        { id: "delta", key: "delta", label: "Delta", format: "number" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Event Date", chartAxis: true, format: "date" },
    ],
    result: {
        supportedChartTypes: ["bar", "line", "area", "horizontal_bar"],
    },
};

const fields = [
    { key: "eventDate", label: "Event Date", kind: "dimension" },
    { key: "profit", label: "Profit", kind: "measure", format: "currency" },
    { key: "delta", label: "Delta", kind: "measure", format: "number" },
];

const invalidPointColors = validateReportBuilderChartSpec(config, {
    type: "line",
    xField: "eventDate",
    yFields: ["profit", "delta"],
    seriesOptions: {
        profit: { pointColorMode: "custom" },
    },
}, fields);
assert.deepEqual(invalidPointColors.errors, [
    { field: "seriesOptions.profit.pointColorMode", code: "invalidPointColorMode" },
]);

const validPointColors = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["profit", "delta"],
    seriesOptions: {
        profit: { pointColorMode: "bySign" },
        delta: { type: "line", axis: "right", pointColorMode: "series" },
    },
}, fields);
assert.deepEqual(validPointColors, { valid: true, errors: [] });

const container = buildExplicitReportBuilderChartContainer(
    { dataSourceRef: "report_source", collection: [] },
    config,
    {
        selectedDimensions: ["eventDate"],
        selectedMeasures: ["profit", "delta"],
    },
    {
        type: "bar",
        xField: "eventDate",
        yFields: ["profit", "delta"],
        seriesOptions: {
            profit: { pointColorMode: "bySign" },
            delta: { type: "line", axis: "right", pointColorMode: "series" },
        },
    },
);

assert.equal(container.chart.series.values[0].pointColorMode, "bySign");
assert.equal(container.chart.series.values[1].pointColorMode, "series");

console.log("reportBuilderComboPointColors ✓ validates and lowers conditional point color rules");
