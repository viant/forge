import assert from "node:assert/strict";

import {
    buildExplicitReportBuilderChartContainer,
    validateReportBuilderChartSpec,
} from "./reportBuilderUtils.js";

const config = {
    measures: [
        { id: "totalSpend", key: "totalSpend", label: "Spend", format: "currency" },
        { id: "impressions", key: "impressions", label: "Impressions", format: "compactNumber" },
    ],
    dimensions: [
        { id: "eventDate", key: "eventDate", label: "Event Date", chartAxis: true, format: "date" },
    ],
    result: {
        supportedChartTypes: ["bar", "line", "horizontal_bar"],
    },
};

const fields = [
    { key: "eventDate", label: "Event Date", kind: "dimension" },
    { key: "totalSpend", label: "Spend", kind: "measure", format: "currency" },
    { key: "impressions", label: "Impressions", kind: "measure", format: "compactNumber" },
];

const invalidDataLabels = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { dataLabels: "sometimes" },
    },
}, fields);
assert.deepEqual(invalidDataLabels.errors, [
    { field: "seriesOptions.totalSpend.dataLabels", code: "invalidDataLabels" },
]);

const validDataLabels = validateReportBuilderChartSpec(config, {
    type: "bar",
    xField: "eventDate",
    yFields: ["totalSpend", "impressions"],
    seriesOptions: {
        totalSpend: { type: "bar", axis: "left", stackId: "primary", dataLabels: "auto" },
        impressions: { type: "line", axis: "right", dataLabels: "always" },
    },
}, fields);
assert.deepEqual(validDataLabels, { valid: true, errors: [] });

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
            totalSpend: { type: "bar", axis: "left", stackId: "primary", dataLabels: "auto" },
            impressions: { type: "line", axis: "right", dataLabels: "always" },
        },
    },
);

assert.equal(comboContainer.chart.series.values[0].dataLabels, "auto");
assert.equal(comboContainer.chart.series.values[1].dataLabels, "always");

console.log("reportBuilderComboDataLabels ✓ validates and lowers per-series data label rules");
