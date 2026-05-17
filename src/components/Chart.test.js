import { describe, expect, it } from 'vitest';

import { aggregateDirectSeriesData, formatTimestamp, resolveVisibleChartState } from './Chart.jsx';

describe('formatTimestamp', () => {
  it('returns empty text for blank timestamps and preserves invalid literal values', () => {
    expect(formatTimestamp('', 'MM/dd')).toBe('');
    expect(formatTimestamp(null, 'MM/dd')).toBe('');
    expect(formatTimestamp('not-a-date', 'MM/dd')).toBe('not-a-date');
  });

  it('formats valid timestamps', () => {
    expect(formatTimestamp('2026-05-14T12:00:00Z', 'MM/dd')).toBe('05/14');
  });
});

describe('resolveVisibleChartState', () => {
  it('keeps the previous chart visible while the next datasource refresh is loading', () => {
    expect(resolveVisibleChartState({
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
    })).toEqual({
      chartData: [{ advertiserTime: '2026-05-14T00:00:00Z', spend: 10 }],
      availableDataKeys: ['spend'],
      yAxisLabel: 'Spend',
      staleWhileLoading: true,
    });
  });

  it('does not reuse the previous chart when the datasource request identity changes', () => {
    expect(resolveVisibleChartState({
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
    })).toEqual({
      chartData: [],
      availableDataKeys: [],
      yAxisLabel: '',
      staleWhileLoading: false,
    });
  });
});

describe('aggregateDirectSeriesData', () => {
  it('aggregates multiple rows with the same x-axis value across selected measures', () => {
    expect(aggregateDirectSeriesData([
      { eventDate: '2026-05-14T00:00:00Z', totalSpend: 10, impressions: 100, channelId: 1 },
      { eventDate: '2026-05-14T00:00:00Z', totalSpend: 7, impressions: 50, channelId: 6 },
      { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25, channelId: 1 },
    ], 'eventDate', [
      { value: 'totalSpend' },
      { value: 'impressions' },
    ])).toEqual([
      { eventDate: '2026-05-14T00:00:00Z', totalSpend: 17, impressions: 150 },
      { eventDate: '2026-05-15T00:00:00Z', totalSpend: 3, impressions: 25 },
    ]);
  });
});
