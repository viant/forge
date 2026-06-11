import assert from 'node:assert/strict';

import {
    aggregateDirectSeriesData,
    buildPieChartData,
    formatTimestamp,
    resolveChartBodyState,
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

assert.deepEqual(aggregateDirectSeriesData([
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 10, impressions: 100, channelId: 1 },
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 7, impressions: 50, channelId: 6 },
    { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25, channelId: 1 },
], 'eventDate', [
    { value: 'totalSpend' },
    { value: 'impressions' },
]), [
    { eventDate: '2026-05-14T00:00:00Z', totalSpend: 17, impressions: 150 },
    { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25 },
]);

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

assert.deepEqual(transformData([
    { eventDate: '2026-05-14T00:00:00Z', channel: { channel: 'CTV' }, avails: 10 },
    { eventDate: '2026-05-14T00:00:00Z', channel: { channel: 'Audio' }, avails: 5 },
    { eventDate: '2026-05-15T00:00:00Z', channel: { channel: 'CTV' }, avails: 8 },
], {
    xAxis: { dataKey: 'eventDate' },
    series: { nameKey: 'channel.channel' },
}, 'avails'), {
    data: [
        { eventDate: '2026-05-14T00:00:00Z', CTV: 10, Audio: 5 },
        { eventDate: '2026-05-15T00:00:00Z', CTV: 8 },
    ],
    keys: ['CTV', 'Audio'],
});

assert.deepEqual(buildPieChartData([
    { channel: { channel: 'CTV' }, avails: 10 },
    { channel: { channel: 'CTV' }, avails: 5 },
    { channel: { channel: 'Audio' }, avails: 3 },
], 'channel.channel', 'avails'), [
    { name: 'CTV', value: 15 },
    { name: 'Audio', value: 3 },
]);

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
