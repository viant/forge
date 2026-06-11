import assert from "node:assert/strict";

import {
    ALL_SUPPORTED_CHART_TYPES,
    chartFamilyAllowsSeriesOptions,
    chartFamilyForType,
    chartFamilyHelperText,
    chartTypeLabel,
    isValidPerSeriesType,
    PER_SERIES_TYPE_CHOICES,
    SINGLE_MEASURE_CATEGORY_TYPES,
    supportsStackForSeries,
    supportsStackIdForSeries,
} from "./reportBuilderChartRules.js";

assert.equal(chartTypeLabel("line"), "Line");
assert.equal(chartTypeLabel("horizontal_bar"), "Horizontal bar");
assert.equal(chartTypeLabel("custom"), "custom");

assert.equal(chartFamilyForType("line"), "cartesian");
assert.equal(chartFamilyForType("donut"), "category");
assert.equal(chartFamilyForType("unknown"), null);

assert.equal(chartFamilyAllowsSeriesOptions("line"), true);
assert.equal(chartFamilyAllowsSeriesOptions("horizontal_bar"), true);
assert.equal(chartFamilyAllowsSeriesOptions("pie"), false);

assert.equal(isValidPerSeriesType("line", "bar"), true);
assert.equal(isValidPerSeriesType("line", "donut"), false);
assert.equal(isValidPerSeriesType("horizontal_bar", "bar"), false);

assert.equal(supportsStackIdForSeries("line", "bar"), true);
assert.equal(supportsStackIdForSeries("line", "line"), false);
assert.equal(supportsStackIdForSeries("horizontal_bar", ""), true);

assert.equal(supportsStackForSeries("line", "bar"), true);
assert.equal(supportsStackForSeries("line", "line"), false);
assert.equal(supportsStackForSeries("horizontal_bar", ""), true);

assert.ok(ALL_SUPPORTED_CHART_TYPES.includes("funnel_bar"));
assert.deepEqual(PER_SERIES_TYPE_CHOICES, ["line", "bar", "area"]);
assert.equal(SINGLE_MEASURE_CATEGORY_TYPES.has("donut"), true);
assert.equal(
    chartFamilyHelperText("pie"),
    "Pie and donut charts use one category dimension and a single measure to slice.",
);

console.log("reportBuilderChartRules ✓");
