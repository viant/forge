import assert from 'node:assert/strict';

import {
    aggregateDirectSeriesData,
    applyChartRowLimit,
    buildPieChartData,
    buildPieSliceCellKey,
    formatChartNumber,
    formatChartXAxisValue,
    hasNonZeroChartSeriesValue,
    formatTimestamp,
    materializeChartDisplayRows,
    resolveChartBodyState,
    resolveChartAnimationActive,
    resolveChartLoadingState,
    resolveHorizontalBarDataLabelLayout,
    resolveHorizontalBarLayout,
    resolveResponsiveCivilDateAxis,
    resolveResponsiveChartType,
    resolveChartValueAxisDomain,
    resolveChartTableMinWidth,
    resolveVisibleChartState,
    transformData,
} from './chartData.js';

assert.equal(formatTimestamp('', 'MM/dd'), '');
assert.equal(formatTimestamp(null, 'MM/dd'), '');
assert.equal(formatChartXAxisValue('2026-09-05', 'MM/dd'), '09/05');
assert.equal(formatChartXAxisValue('2026-09-11', 'MM/dd'), '09/11');
assert.equal(formatTimestamp('not-a-date', 'MM/dd'), 'not-a-date');
assert.equal(formatTimestamp('2026-05-14T12:00:00Z', 'MM/dd'), '05/14');
assert.equal(formatChartXAxisValue(5), '5');
assert.equal(formatChartXAxisValue('2026-05-14T12:00:00Z'), '2026-05-14T12:00:00Z');
assert.equal(formatChartXAxisValue('2026-05-14T12:00:00Z', 'MM/dd'), '05/14');
assert.equal(formatChartXAxisValue('2026-05-14T00:00:00Z', 'MM/dd', 'civil'), '05/14');
assert.equal(resolveChartTableMinWidth([110, 110, 110]), 330);
assert.equal(resolveChartTableMinWidth([160, 240, 320]), 720);
const fullChartRows = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));
assert.deepEqual(applyChartRowLimit(fullChartRows, 4).map((row) => row.id), [1, 2, 3, 4]);
assert.equal(applyChartRowLimit(fullChartRows, 0), fullChartRows);
assert.equal(resolveResponsiveChartType("bar", 390, {
    xAxis: { dataKey: "device" },
    rows: [{ device: "Mobile" }, { device: "Connected TV" }],
}), "horizontal_bar");
assert.equal(resolveResponsiveChartType("bar", 390, {
    xAxis: { dataKey: "date" },
    rows: [{ date: "2026-08-20" }, { date: "2026-08-21" }],
}), "bar");
assert.equal(resolveResponsiveChartType("bar", 1024, {
    xAxis: { dataKey: "device" },
    rows: [{ device: "Mobile" }],
}), "bar");
const civilDateRows = Array.from({ length: 8 }, (_, index) => ({ date: `2026-08-${String(20 + index).padStart(2, "0")}`, value: index + 1 }));
assert.deepEqual(resolveResponsiveCivilDateAxis(civilDateRows, "date", 320), {
    compact: true,
    ticks: ["2026-08-20", "2026-08-27"],
    tickFormat: "MM/dd",
    bottomMargin: 72,
    labelPosition: "bottom",
    labelOffset: 18,
});
assert.equal(resolveResponsiveCivilDateAxis(civilDateRows, "date", 900).ticks, undefined);

const signedBarDomain = resolveChartValueAxisDomain('horizontal_bar');
assert.equal(signedBarDomain[0](-31385), -31385);
assert.equal(signedBarDomain[1](-31381), 0);
const positiveBarDomain = resolveChartValueAxisDomain('bar');
assert.equal(positiveBarDomain[0](42), 0);
assert.equal(positiveBarDomain[1](84), 84);
assert.equal(resolveChartValueAxisDomain('line'), undefined);
assert.deepEqual(resolveChartValueAxisDomain('bar', [-100, 100]), [-100, 100]);
assert.equal(resolveChartAnimationActive({}), false);
assert.equal(resolveChartAnimationActive({ animate: true }), true);
assert.equal(resolveChartAnimationActive({ animation: true }), true);

assert.deepEqual(resolveVisibleChartState({
    chartData: [],
    availableDataKeys: [],
    yAxisLabel: '',
    loading: true,
    error: null,
    sourceKey: 'same-source',
    previousState: {
        chartData: [{ advertiserTime: '2026-05-14T00:00:00Z', spend: 10 }],
        availableDataKeys: ['spend'],
        yAxisLabel: 'Spend',
        sourceKey: 'same-source',
    },
}), {
    chartData: [{ advertiserTime: '2026-05-14T00:00:00Z', spend: 10 }],
    availableDataKeys: ['spend'],
    yAxisLabel: 'Spend',
    staleWhileLoading: true,
});

assert.deepEqual(resolveVisibleChartState({
    chartData: [],
    availableDataKeys: [],
    yAxisLabel: '',
    loading: true,
    error: null,
    sourceKey: 'new-source',
    previousState: {
        chartData: [{ advertiserTime: '2026-05-14T00:00:00Z', spend: 10 }],
        availableDataKeys: ['spend'],
        yAxisLabel: 'Spend',
        sourceKey: 'old-source',
    },
}), {
    chartData: [],
    availableDataKeys: [],
    yAxisLabel: '',
    staleWhileLoading: false,
});

assert.equal(resolveChartLoadingState({
    loading: true,
    collectionOverride: [{ eventDate: '2026-05-14T00:00:00Z', spend: 10 }],
}), false);

assert.equal(resolveChartLoadingState({
    loading: true,
    collectionOverride: [],
}), true);

const directAggregated = aggregateDirectSeriesData([
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 10, impressions: 100, channelId: 1 },
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 7, impressions: 50, channelId: 6 },
    { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25, channelId: 1 },
], 'eventDate', [
    { value: 'totalSpend' },
    { value: 'impressions' },
]);
assert.deepEqual(directAggregated, [
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 17, impressions: 150 },
    { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25 },
]);
assert.equal(Array.isArray(directAggregated[0].__chartSelectionRows), true);
assert.equal(directAggregated[0].__chartSelectionRows.length, 2);

assert.deepEqual(aggregateDirectSeriesData([
    { channel: { channel: 'CTV' }, avails: 10 },
    { channel: { channel: 'CTV' }, avails: 5 },
    { channel: { channel: 'Audio' }, avails: 3 },
], 'channel.channel', [
    { value: 'avails' },
]), [
    { channel: { channel: 'CTV' }, avails: 15 },
    { channel: { channel: 'Audio' }, avails: 3 },
]);

const transformed = transformData([
    { eventDate: '2026-05-14T00:00:00Z', channel: { channel: 'CTV' }, avails: 10 },
    { eventDate: '2026-05-14T00:00:00Z', channel: { channel: 'Audio' }, avails: 5 },
    { eventDate: '2026-05-15T00:00:00Z', channel: { channel: 'CTV' }, avails: 8 },
], {
    xAxis: { dataKey: 'eventDate' },
    series: { nameKey: 'channel.channel' },
}, 'avails');
assert.deepEqual(transformed, {
    data: [
        { eventDate: '2026-05-14T00:00:00Z', CTV: 10, Audio: 5 },
        { eventDate: '2026-05-15T00:00:00Z', CTV: 8 },
    ],
    keys: ['CTV', 'Audio'],
});
assert.equal(Array.isArray(transformed.data[0].__chartSelectionRows.CTV), true);
assert.equal(transformed.data[0].__chartSelectionRows.CTV.length, 1);
assert.equal(Array.isArray(transformed.data[0].__chartSelectionRows.Audio), true);

const pieData = buildPieChartData([
    { channel: { channel: 'CTV' }, avails: 10 },
    { channel: { channel: 'CTV' }, avails: 5 },
    { channel: { channel: 'Audio' }, avails: 3 },
], 'channel.channel', 'avails');
assert.deepEqual(pieData, [
    { name: 'CTV', value: 15 },
    { name: 'Audio', value: 3 },
]);
assert.equal(Array.isArray(pieData[0].__chartSelectionRows), true);
assert.equal(pieData[0].__chartSelectionRows.length, 2);
assert.equal(buildPieSliceCellKey({ name: "unknown" }, 0), "unknown-0");
assert.equal(buildPieSliceCellKey({ name: "unknown" }, 1), "unknown-1");
assert.equal(buildPieSliceCellKey({}, 2), "unknown-2");

assert.deepEqual(materializeChartDisplayRows({
    type: 'line',
    xAxis: { dataKey: 'eventDate' },
    series: {
        nameKey: 'channelName',
        sourceNameKey: 'channelId',
        displayValueMap: {
            '1': 'Display',
            '2': 'CTV',
        },
        valueKey: 'spend',
        values: [{ value: 'spend', label: 'Spend', color: '#1f77b4', type: 'line' }],
        palette: ['#1f77b4'],
    },
}, [
    { eventDate: '2026-05-14T00:00:00Z', channelId: 1, spend: 10 },
    { eventDate: '2026-05-15T00:00:00Z', channelId: 2, spend: 12 },
]), [
    { eventDate: '2026-05-14T00:00:00Z', channelId: 1, channelName: 'Display', spend: 10 },
    { eventDate: '2026-05-15T00:00:00Z', channelId: 2, channelName: 'CTV', spend: 12 },
]);

assert.deepEqual(materializeChartDisplayRows({
    type: 'line',
    xAxis: { dataKey: 'eventDate' },
    series: {
        nameKey: 'channelId',
        sourceNameKey: 'channelId',
        displayValueMap: {
            '1': 'Display',
            '2': 'CTV',
        },
        valueKey: 'spend',
        values: [{ value: 'spend', label: 'Spend', color: '#1f77b4', type: 'line' }],
        palette: ['#1f77b4'],
    },
}, [
    { eventDate: '2026-05-14T00:00:00Z', channelId: 1, spend: 10 },
    { eventDate: '2026-05-15T00:00:00Z', channelId: 2, spend: 12 },
]), [
    { eventDate: '2026-05-14T00:00:00Z', channelId: 'Display', spend: 10 },
    { eventDate: '2026-05-15T00:00:00Z', channelId: 'CTV', spend: 12 },
]);

const preservedSelectionRows = materializeChartDisplayRows({
    type: 'line',
    xAxis: { dataKey: 'eventDate' },
    series: {
        nameKey: 'channelName',
        sourceNameKey: 'channelId',
        displayValueMap: {
            '1': 'Display',
        },
        valueKey: 'spend',
        values: [{ value: 'spend', label: 'Spend', color: '#1f77b4', type: 'line' }],
        palette: ['#1f77b4'],
    },
}, [
    Object.defineProperty({ eventDate: '2026-05-14T00:00:00Z', channelId: 1, spend: 10 }, '__chartSelectionRows', {
        value: [{ campaign: 'Prospect Sprint' }],
        enumerable: false,
        writable: true,
        configurable: true,
    }),
]);
assert.deepEqual(preservedSelectionRows[0].__chartSelectionRows, [{ campaign: 'Prospect Sprint' }]);

assert.deepEqual(transformData(materializeChartDisplayRows({
    type: 'line',
    xAxis: { dataKey: 'eventDate' },
    series: {
        nameKey: 'channelName',
        sourceNameKey: 'channelId',
        displayValueMap: {
            '1': 'Display',
            '2': 'CTV',
        },
        valueKey: 'spend',
        values: [{ value: 'spend', label: 'Spend', color: '#1f77b4', type: 'line' }],
        palette: ['#1f77b4'],
    },
}, [
    { eventDate: '2026-05-14T00:00:00Z', channelId: 1, spend: 10 },
    { eventDate: '2026-05-14T00:00:00Z', channelId: 2, spend: 5 },
]), {
    xAxis: { dataKey: 'eventDate' },
    series: { nameKey: 'channelName' },
}, 'spend'), {
    data: [
        { eventDate: '2026-05-14T00:00:00Z', Display: 10, CTV: 5 },
    ],
    keys: ['Display', 'CTV'],
});

assert.deepEqual(resolveChartBodyState({
    loading: true,
    error: null,
    hasUnderlyingChartRows: false,
    canRenderChartSelection: false,
    hasChartRows: false,
    hasRenderableSeriesValues: false,
    showResolvedEmptyStateWhileLoading: true,
}), {
    showSelectionMessage: false,
    showEmptyDataMessage: true,
});

assert.deepEqual(resolveChartBodyState({
    loading: false,
    error: null,
    hasUnderlyingChartRows: true,
    canRenderChartSelection: false,
    hasChartRows: false,
    hasRenderableSeriesValues: false,
    showResolvedEmptyStateWhileLoading: false,
}), {
    showSelectionMessage: true,
    showEmptyDataMessage: false,
});

assert.equal(formatChartNumber(-31382.314905724586), "-31.38K");
assert.equal(formatChartNumber(315.8579386163547), "315.86");
assert.equal(formatChartNumber(0), "0");
assert.deepEqual(resolveHorizontalBarDataLabelLayout({ x: 300, width: -200, value: -12 }), {
    x: 106,
    textAnchor: "start",
    fill: "#ffffff",
});
assert.deepEqual(resolveHorizontalBarDataLabelLayout({ x: 100, width: 12, value: 8 }), {
    x: 118,
    textAnchor: "start",
    fill: "#5f6b7c",
});
assert.deepEqual(resolveHorizontalBarLayout({
    containerWidth: 280,
    categoryLabel: { lines: 2, maxCharacters: 48 },
}), {
    compact: true,
    width: "100%",
    categoryWidth: 112,
    categoryLabel: { lines: 2, maxCharacters: 14 },
    margin: { top: 10, right: 36, left: 8, bottom: 54 },
    numericTickCount: 3,
    numericMinTickGap: 18,
    estimatedPlotWidth: 124,
});
assert.deepEqual(resolveHorizontalBarLayout({
    containerWidth: 900,
    embedded: true,
    categoryLabel: { lines: 2, maxCharacters: 36 },
}), {
    compact: false,
    width: "82%",
    categoryWidth: 378,
    categoryLabel: { lines: 2, maxCharacters: 36 },
    margin: { top: 24, right: 12, left: 6, bottom: 48 },
    numericTickCount: undefined,
    numericMinTickGap: 5,
    estimatedPlotWidth: 504,
});
assert.equal(hasNonZeroChartSeriesValue([{ conversions: 0 }, { conversions: 0 }], ["conversions"]), false);
assert.equal(hasNonZeroChartSeriesValue([{ conversions: 0 }, { conversions: 1 }], ["conversions"]), true);

console.log('Chart ✓ transform, aggregation, and state helpers');
