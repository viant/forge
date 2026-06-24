import { describe, expect, it } from 'vitest';

import { resolveDefaultDataSourceRef, resolveFetcherOwnedDataSourceRefs, resolveInitialWindowFormValues, resolveRequiredDataSourceRefs, resolveWindowMetadataForTarget, shouldPreserveMissingResolvedParameters, shouldPrimeDataSourceFetch, shouldResetWindowDashboardState } from './WindowContent.jsx';

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

describe('resolveDefaultDataSourceRef', () => {
  it('prefers the root content datasource ref over object-key inference', () => {
    const metadata = {
      dataSource: {
        order_performance_period_today: {},
        recommendation: {},
      },
      view: {
        content: {
          id: 'recommendationRoot',
          dataSourceRef: 'recommendation',
          containers: [],
        },
      },
    };

    expect(resolveDefaultDataSourceRef(metadata)).toBe('recommendation');
  });
});

describe('resolveWindowMetadataForTarget', () => {
  it('applies targetOverrides before window metadata is stored', () => {
    const metadata = {
      view: {
        content: {
          containers: [{ id: 'base' }],
          targetOverrides: {
            web: {
              containers: [{ id: 'webGrid' }],
            },
            mobile: {
              containers: [{ id: 'mobileTabs' }],
            },
          },
        },
      },
    };

    expect(resolveWindowMetadataForTarget(metadata, { platform: 'web', formFactor: 'desktop' }).view.content.containers).toEqual([
      { id: 'webGrid' },
    ]);
    expect(resolveWindowMetadataForTarget(metadata, { platform: 'ios', formFactor: 'tablet' }).view.content.containers).toEqual([
      { id: 'mobileTabs' },
    ]);
  });
});

describe('resolveFetcherOwnedDataSourceRefs', () => {
  it('collects datasource refs owned only by explicit fetchData containers', () => {
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

    expect(resolveFetcherOwnedDataSourceRefs(metadata)).toEqual(['meta']);
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

describe('shouldPreserveMissingResolvedParameters', () => {
  it('preserves existing parameters when metadata opts into transient missing dependency protection', () => {
    expect(
      shouldPreserveMissingResolvedParameters(
        {
          preserveParametersOnMissingDependencies: true,
          parameters: [{ name: 'scheduleId', in: 'dataSource', location: 'schedules.id' }],
        },
        { scheduleId: 'schedule-1' },
        {},
        {},
      ),
    ).toBe(true);
  });

  it('does not preserve parameters without opt-in', () => {
    expect(
      shouldPreserveMissingResolvedParameters(
        { parameters: [{ name: 'scheduleId', in: 'dataSource', location: 'schedules.id' }] },
        { scheduleId: 'schedule-1' },
        {},
        {},
      ),
    ).toBe(false);
  });
});

describe('shouldResetWindowDashboardState', () => {
  it('runs only once for the same window/dashboard identity', () => {
    expect(shouldResetWindowDashboardState('', 'window-1', 'dashboard-1')).toBe(true);
    expect(shouldResetWindowDashboardState('window-1:dashboard-1', 'window-1', 'dashboard-1')).toBe(false);
  });

  it('allows resets when the window or dashboard identity changes', () => {
    expect(shouldResetWindowDashboardState('window-1:dashboard-1', 'window-2', 'dashboard-1')).toBe(true);
    expect(shouldResetWindowDashboardState('window-1:dashboard-1', 'window-1', 'dashboard-2')).toBe(true);
    expect(shouldResetWindowDashboardState('', '', 'dashboard-1')).toBe(false);
    expect(shouldResetWindowDashboardState('', 'window-1', '')).toBe(false);
  });
});
