import { describe, expect, it } from 'vitest';

import { resolveFetcherOwnedDataSourceRefs, resolveInitialWindowFormValues, resolveRequiredDataSourceRefs, shouldPrimeDataSourceFetch } from './WindowContent.jsx';

describe('resolveInitialWindowFormValues', () => {
  it('collects explicit windowForm item values alongside onInit constants', () => {
    const metadata = {
      window: {
        on: [
          {
            event: 'onInit',
            handler: 'dataSource.setWindowFormData',
            parameters: [
              { in: 'const', name: 'seedOnly', location: 'keep-me' },
            ],
          },
        ],
      },
      view: {
        content: {
          id: 'root',
          containers: [
            {
              id: 'deliveryTab',
              items: [
                { id: 'periodView', scope: 'windowForm', value: 'today' },
                { id: 'granularity', scope: 'windowForm', value: 'day' },
                { id: 'ignored', scope: 'form', value: 'x' },
              ],
            },
          ],
        },
      },
    };

    expect(resolveInitialWindowFormValues(metadata)).toEqual({
      seedOnly: 'keep-me',
      periodView: 'today',
      granularity: 'day',
    });
  });
});

describe('resolveRequiredDataSourceRefs', () => {
  it('includes only the selected mapped datasource ref for windowForm-driven charts', () => {
    const metadata = {
      dataSource: {
        order_performance_profile: {},
        order_performance_period_today: {},
        order_performance_period_yesterday: {},
        order_performance_period_7d: {},
        order_performance_period_30d: {},
      },
      view: {
        content: {
          id: 'root',
          containers: [
            {
              id: 'deliveryTab',
              chart: {
                dataSourceRefSelector: 'periodView',
                dataSourceRefSource: 'windowForm',
                dataSourceRefs: {
                  today: 'order_performance_period_today',
                  yesterday: 'order_performance_period_yesterday',
                  '7d': 'order_performance_period_7d',
                  '30d': 'order_performance_period_30d',
                },
              },
            },
          ],
        },
      },
    };

    expect(resolveRequiredDataSourceRefs(metadata, 'order_performance_profile', { periodView: '7d' })).toEqual([
      'order_performance_profile',
      'order_performance_period_7d',
    ]);
  });
});

describe('resolveFetcherOwnedDataSourceRefs', () => {
  it('collects datasource refs owned by explicit container fetchers', () => {
    const metadata = {
      view: {
        content: {
          id: 'root',
          containers: [
            {
              id: 'metaLoader',
              dataSourceRef: 'meta',
              fetchData: true,
            },
            {
              id: 'visiblePanel',
              dataSourceRef: 'profile',
              selectFirst: true,
              table: {},
            },
          ],
        },
      },
    };

    expect(resolveFetcherOwnedDataSourceRefs(metadata)).toEqual(['meta', 'profile']);
  });
});

describe('shouldPrimeDataSourceFetch', () => {
  it('does not auto-fetch empty user-driven datasources', () => {
    expect(
      shouldPrimeDataSourceFetch({ autoFetch: false }, { parameters: {} }, [], true),
    ).toBe(false);
  });

  it('preserves an explicit fetch requested downstream', () => {
    expect(
      shouldPrimeDataSourceFetch({ autoFetch: false }, { fetch: true }, [], false),
    ).toBe(true);
  });

  it('auto-fetches empty datasources by default', () => {
    expect(
      shouldPrimeDataSourceFetch({}, { parameters: {} }, [], false),
    ).toBe(true);
  });

  it('does not require window bootstrap to own request parameters for user-driven datasources', () => {
    expect(
      shouldPrimeDataSourceFetch({ autoFetch: false, parameters: [] }, { parameters: { measures: { totalSpend: true } } }, [], false),
    ).toBe(false);
  });
});
