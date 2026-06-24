import { describe, expect, it } from 'vitest';

import { mergeWindowFormValues, withWindowFormPrefillRevision } from './dataSource.js';

describe('mergeWindowFormValues', () => {
  it('preserves seeded window parameters while applying defaults', () => {
    expect(
      mergeWindowFormValues(
        { AdOrderId: [2637048], periodView: 'today' },
        { periodView: '30d', granularity: 'day' },
      ),
    ).toEqual({
      AdOrderId: [2637048],
      periodView: '30d',
      granularity: 'day',
    });
  });

  it('accepts empty existing state', () => {
    expect(mergeWindowFormValues(null, { granularity: 'hour' })).toEqual({
      granularity: 'hour',
    });
  });

  it('merges nested subtrees unless a replacement sentinel is used', () => {
    const previous = {
      capacityCubeBuilder: {
        chartSpec: {
          title: 'Area by Date and Channel',
          type: 'area',
          xField: 'eventDate',
          yFields: ['avails'],
          seriesField: 'channelV2',
        },
      },
    };
    const next = {
      capacityCubeBuilder: {
        chartSpec: {
          title: 'Avails by Date',
          type: 'line',
          xField: 'eventDate',
          yFields: ['avails'],
        },
      },
    };
    expect(mergeWindowFormValues(previous, next)).toEqual({
      capacityCubeBuilder: {
        chartSpec: {
          title: 'Avails by Date',
          type: 'line',
          xField: 'eventDate',
          yFields: ['avails'],
          seriesField: 'channelV2',
        },
      },
    });
  });

  it('replaces only subtrees marked with the window-form replace sentinel', () => {
    const previous = {
      prefill: {
        includeCountry: ['US'],
        includeDealsPmp: [101, 102],
        includePostalCodeList: [303],
      },
      capacityCubeBuilder: {
        chartSpec: {
          title: 'Area by Date and Channel',
          seriesField: 'channelV2',
        },
      },
    };
    const next = {
      prefill: {
        includeDealsPmp: {
          $replace: true,
          value: [201],
        },
        includePostalCodeList: {
          $replace: true,
          value: [],
        },
      },
      capacityCubeBuilder: {
        chartSpec: {
          $replace: true,
          value: {
            title: 'Avails by Date',
          },
        },
      },
    };

    expect(mergeWindowFormValues(previous, next)).toEqual({
      prefill: {
        includeCountry: ['US'],
        includeDealsPmp: [201],
        includePostalCodeList: [],
      },
      capacityCubeBuilder: {
        chartSpec: {
          title: 'Avails by Date',
        },
      },
    });
  });

  it('bumps a generic prefill revision for repeated semantic handoffs', () => {
    const first = withWindowFormPrefillRevision({}, {
      prefill: { dealId: 778899 },
    });
    expect(first.__forge.prefillRevision).toBe(1);

    const second = withWindowFormPrefillRevision(first, {
      prefill: { dealId: 778899 },
    });
    expect(second.__forge.prefillRevision).toBe(2);
  });

  it('does not add revision metadata for non-prefill patches', () => {
    expect(withWindowFormPrefillRevision({ __forge: { prefillRevision: 4 } }, {
      granularity: 'hour',
    })).toEqual({
      granularity: 'hour',
    });
  });
});
