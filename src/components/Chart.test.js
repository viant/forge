import assert from 'node:assert/strict';

import {
    aggregateDirectSeriesData,
    buildPieChartData,
    buildPieSliceCellKey,
    formatTimestamp,
    materializeChartDisplayRows,
    resolveChartBodyState,
    resolveChartLoadingState,
    resolveVisibleChartState,
    transformData,
} from './chartData.js';

assert.equal(formatTimestamp('', 'MM/dd'), '');
assert.equal(formatTimestamp(null, 'MM/dd'), '');
assert.equal(formatTimestamp('not-a-date', 'MM/dd'), 'not-a-date');
assert.equal(formatTimestamp('2026-05-14T12:00:00Z', 'MM/dd'), '05/14');

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

console.log('Chart ✓ transform, aggregation, and state helpers');
