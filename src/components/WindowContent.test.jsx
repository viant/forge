import { describe, expect, it } from 'vitest';

import { applyWindowPermissionMetadata, canUseInlineMetadataFallback, compilePermissionAppliedMetadata, formatWindowMetadataError, isProtectedWindowMetadata, resolveDefaultDataSourceRef, resolveFetcherOwnedDataSourceRefs, resolveInitialWindowFormValues, resolveRequiredDataSourceRefs, resolveWindowDataSourceFetchFlag, resolveWindowMetadataDisplayState, resolveWindowMetadataForTarget, resolveWindowRootContainer, reuseShallowEqualRuntimeObject, shouldPreserveMissingResolvedParameters, shouldPrimeDataSourceFetch, shouldResetWindowDashboardState } from './WindowContent.jsx';
import { resolveDataSourceOptions } from '../runtime/WidgetRenderer.jsx';

describe('local datasource parent placeholder', () => {
  it('does not mount the undeclared underscore parent of a local shell datasource', () => {
    const metadata = {dataSource: {settings: {dataSourceRef: '_'}}, view: {content: {dataSourceRef: 'settings'}}};
    expect(resolveRequiredDataSourceRefs(metadata, 'settings')).toEqual(['settings']);
    metadata.dataSource.settings.dataSourceRef = 'missingBusinessParent';
    expect(resolveRequiredDataSourceRefs(metadata, 'settings')).toEqual(['settings', 'missingBusinessParent']);
    metadata.dataSource.settings.dataSourceRef = '_';
    metadata.dataSource._ = {};
    expect(resolveRequiredDataSourceRefs(metadata, 'settings')).toEqual(['settings', '_']);
  });
});

describe('applyWindowPermissionMetadata', () => {
  it('passes the complete tree and one concrete resource to the dedicated service', async () => {
    const completeMetadata = {authorization: {scope: 'resource'}, view: {content: {id: 'root'}}};
    const calls = [];
    const permitted = {authorizationSnapshot: {resources: {'42': {id: 42}}}, view: {content: {id: 'root'}}};
    const result = await applyWindowPermissionMetadata(completeMetadata, {
      services: {applyPermission: async (input) => { calls.push(input); return permitted; }},
      windowId: 'document-42', windowKey: 'document',
      resource: {DocumentId: [42]},
      windowParams: {DocumentId: [42]},
    });
    expect(result).toBe(permitted);
    expect(calls).toEqual([expect.objectContaining({
      windowId: 'document-42', windowKey: 'document', completeMetadata, resource: {DocumentId: [42]},
    })]);
  });

  it('renders a published canonical window without another permission decision', async () => {
    const binding = {token: 'synthetic-existing-binding', parametersDigest: 'synthetic-digest'};
    const completeMetadata = {resource: {uri: 'window://example/recordList'}, selectionBinding: binding, view: {content: {id: 'root'}}};
    const parameters = {Selected: [42]};
    const calls = [];
    const result = await applyWindowPermissionMetadata(completeMetadata, {
      services: {applyPermission: async input => {calls.push(input); throw new Error('Duplicate resource permission check');}},
      windowKey: 'recordList', windowParams: parameters,
    });
    expect(calls).toEqual([]);
    expect(result).toBe(completeMetadata);
    expect(result.selectionBinding).toBe(binding);
    expect(result.authorization).toBeUndefined();
  });

  it('does not require a permission service just because the resource uses window://', async () => {
    const metadata = {resource: {uri: 'window://example/list'}};
    expect(await applyWindowPermissionMetadata(metadata, {services: {}})).toBe(metadata);
  });

  it('leaves unpinned metadata and other resource kinds unchanged', async () => {
    let calls = 0;
    const services = {applyPermission: async () => {calls++;}};
    for (const metadata of [{view: {content: {id: 'public'}}}, {resource: {uri: 'datasource://example/rows'}}]) {
      expect(await applyWindowPermissionMetadata(metadata, {services})).toBe(metadata);
    }
    expect(calls).toBe(0);
  });
});

describe('window metadata authorization states', () => {
  it('does not render protected inline metadata before a permission snapshot exists', () => {
    expect(canUseInlineMetadataFallback({authorization: {scope: 'resource'}, view: {content: {id: 'protected'}}})).toBe(false);
    expect(canUseInlineMetadataFallback({authorization: {scope: 'resource'}, authorizationSnapshot: {resources: {}}, view: {content: {id: 'permitted'}}})).toBe(false);
    expect(canUseInlineMetadataFallback({authorizationSnapshot: {resources: {'95420': {id: 95420}}}, view: {content: {id: 'compiled-protected'}}})).toBe(false);
    expect(canUseInlineMetadataFallback({view: {content: {id: 'public'}}})).toBe(true);
    expect(isProtectedWindowMetadata({authorizationSnapshot: {resources: {}}})).toBe(true);
  });

  it('distinguishes forbidden resources from expired authentication', () => {
    expect(formatWindowMetadataError({status: 403})).toBe('Access denied. You do not have permission to open this resource.');
    expect(formatWindowMetadataError({status: 401})).toBe('Authentication required. Please sign in to continue.');
    expect(formatWindowMetadataError({status: 500, message: 'boom'})).toBe('Failed to load window: boom');
  });

  it('shows a terminal metadata error instead of leaving the window on its loading skeleton', () => {
    expect(resolveWindowMetadataDisplayState({
      loading: false,
      signalsReady: false,
      metadata: undefined,
      fetchError: {status: 403},
    })).toBe('error');
    expect(resolveWindowMetadataDisplayState({
      loading: true,
      signalsReady: false,
      metadata: undefined,
      fetchError: null,
    })).toBe('loading');
  });
});

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
              { in: 'const', name: 'booleanSeed', location: 'true', codec: {name: 'boolean'} },
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
      booleanSeed: true,
      periodView: 'today',
      granularity: 'day',
    });
  });
});

describe('resolveRequiredDataSourceRefs', () => {
  it('includes only the selected mapped datasource ref for windowForm-driven charts', () => {
    const metadata = {
      dataSource: {
        report_profile: {},
        report_period_today: {},
        report_period_yesterday: {},
        report_period_7d: {},
        report_period_30d: {},
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
                  today: 'report_period_today',
                  yesterday: 'report_period_yesterday',
                  '7d': 'report_period_7d',
                  '30d': 'report_period_30d',
                },
              },
            },
          ],
        },
      },
    };

    expect(resolveRequiredDataSourceRefs(metadata, 'report_profile', { periodView: '7d' })).toEqual([
      'report_profile',
      'report_period_7d',
    ]);
  });

  it('does not mount datasource refs owned by windowForm-hidden period panels', () => {
    const metadata = {
      dataSource: {
        report_period_today: {},
        report_period_30d: {},
        report_period_custom: {},
      },
      view: {content: {containers: [
        {id: 'today', dataSourceRef: 'report_period_today', visibleWhen: {source: 'windowForm', field: 'periodView', equals: 'today'}},
        {id: 'month', dataSourceRef: 'report_period_30d', visibleWhen: {source: 'windowForm', field: 'periodView', equals: '30d'}},
        {id: 'custom', dataSourceRef: 'report_period_custom', visibleWhen: {all: [
          {source: 'windowForm', field: 'periodView', equals: 'custom'},
          {source: 'windowForm', field: 'linePerformanceValidationError', empty: true},
        ]}},
      ]}},
    };

    expect(resolveRequiredDataSourceRefs(metadata, '', {periodView: '30d'})).toEqual(['report_period_30d']);
    expect(resolveRequiredDataSourceRefs(metadata, '', {periodView: 'custom', linePerformanceValidationError: 'Choose both dates.'})).toEqual([]);
    expect(resolveRequiredDataSourceRefs(metadata, '', {periodView: 'custom', linePerformanceValidationError: ''})).toEqual(['report_period_custom']);
  });

  it('includes an options datasource used by a form select', () => {
    const metadata = {
      dataSource: { product: {}, product_categories: {}, fallback_categories: {} },
      view: {
        content: {
          dataSourceRef: 'product',
          items: [{
            id: 'category',
            type: 'select',
            optionsDataSourceRef: 'product_categories',
            fallbackOptionsDataSourceRef: 'fallback_categories',
          }],
        },
      },
    };

    expect(resolveRequiredDataSourceRefs(metadata, 'product', {})).toEqual([
      'product',
      'product_categories',
      'fallback_categories',
    ]);
  });

  it('mounts report-builder definition datasources before compile', () => {
    const metadata = {
      dataSource: {
        report_rows: {},
        report_definition: {},
      },
      view: {
        content: {
          dataSourceRef: 'report_rows',
          definitionDataSourceRef: 'report_definition',
        },
      },
    };

    expect(resolveRequiredDataSourceRefs(metadata, '', {})).toEqual([
      'report_rows',
      'report_definition',
    ]);
  });

  it('mounts datasource refs only for the selected tab', () => {
    const metadata = {
      dataSource: { advertiser_properties: {}, advertiser_campaigns: {}, advertiser_orders: {} },
      window: { titleBinding: { dataSourceRef: 'advertiser_properties' } },
      view: {
        content: {
          id: 'advertiserRoot',
          containers: [{
            id: 'advertiserTabs',
            tabs: { defaultSelectedTabId: 'properties', renderActiveTabPanelOnly: true },
            containers: [
              { id: 'properties', dataSourceRef: 'advertiser_properties' },
              { id: 'campaigns', dataSourceRef: 'advertiser_campaigns' },
              { id: 'orders', dataSourceRef: 'advertiser_orders' },
            ],
          }],
        },
      },
    };

    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {})).toEqual(['advertiser_properties']);
    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {tabs: {advertiserTabs: 'orders'}})).toEqual([
      'advertiser_properties',
      'advertiser_orders',
    ]);
  });

  it('defers inactive stable tab datasources until selection', () => {
    const metadata = {
      dataSource: {line_properties: {}, line_performance: {}, line_creatives: {}},
      view: {content: {id: 'root', containers: [{
        id: 'lineWorkspaceBody',
        stableTabs: {defaultSelectedTabId: 'lineProperties', renderActiveTabPanelOnly: true, keepVisitedTabPanelsMounted: true},
        containers: [
          {id: 'lineProperties', dataSourceRef: 'line_properties'},
          {id: 'linePerformance', dataSourceRef: 'line_performance'},
          {id: 'lineCreatives', dataSourceRef: 'line_creatives'},
        ],
      }]}}
    };
    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {})).toEqual(['line_properties']);
    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {tabs: {lineWorkspaceBody: 'lineCreatives'}}))
      .toEqual(['line_creatives']);
  });

  it('defaults to the selected panel and preserves explicit all-panel mounting', () => {
    const metadata = {
      dataSource: { properties: {}, campaigns: {}, orders: {} },
      view: {content: {
        id: 'tabs',
        tabs: {defaultSelectedTabId: 'properties'},
        containers: [
          {id: 'properties', dataSourceRef: 'properties'},
          {id: 'campaigns', dataSourceRef: 'campaigns'},
          {id: 'orders', dataSourceRef: 'orders'},
        ],
      }},
    };
    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {})).toEqual(['properties']);
    metadata.view.content.tabs.mountPolicy = 'all';
    expect(resolveRequiredDataSourceRefs(metadata, '', {}, {})).toEqual(['properties', 'campaigns', 'orders']);
  });

  it('does not auto-refetch a completed empty datasource until parameters change', () => {
    expect(shouldPrimeDataSourceFetch({}, {}, [], false, {loaded: true})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {}, [], true, {loaded: true})).toBe(true);
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], false, {loaded: true})).toBe(true);
  });
});

describe('resolveDataSourceOptions', () => {
  it('maps live datasource rows into select options', () => {
    const context = {
      Context: () => ({
        signals: {
          collection: { value: [{ caption: 'Category A' }, { caption: 'Category B' }] },
        },
      }),
    };

    expect(resolveDataSourceOptions({
      optionsDataSourceRef: 'product_categories',
      optionLabelField: 'caption',
      optionValueField: 'caption',
    }, context)).toEqual([
      { value: 'Category A', label: 'Category A', disabled: false },
      { value: 'Category B', label: 'Category B', disabled: false },
    ]);
  });

  it('adds a dictionary identifier to the display label without changing the stored value', () => {
    const context = {
      Context: () => ({
        signals: {
          collection: { value: [{ id: 2, caption: 'Category B' }] },
        },
      }),
    };

    expect(resolveDataSourceOptions({
      optionsDataSourceRef: 'product_categories',
      optionLabelField: 'caption',
      optionValueField: 'caption',
      optionSecondaryField: 'id',
    }, context)).toEqual([
      { value: 'Category B', label: 'Category B (2)', secondary: 2, disabled: false },
    ]);
  });

  it('filters datasource options from a reactive form selector', () => {
    const context = {
      signals: { form: { value: { group: 'Demographics' } } },
      Context: () => ({
        signals: {
          collection: { value: [
            { value: 'age:5', label: '18-24', group: 'Demographics' },
            { value: 'browser:chrome', label: 'Chrome', group: 'Device' },
          ] },
        },
      }),
    };

    expect(resolveDataSourceOptions({
      optionsDataSourceRef: 'targeting_options',
      optionLabelField: 'label',
      optionValueField: 'value',
      optionFilter: { field: 'group', source: 'form', selector: 'group' },
    }, context)).toEqual([{ value: 'age:5', label: '18-24', disabled: false }]);
  });

});

describe('resolveDefaultDataSourceRef', () => {
  it('prefers the title binding over an arbitrary datasource map order', () => {
    expect(resolveDefaultDataSourceRef({
      dataSource: { advertiser_history: {}, advertiser_properties: {} },
      window: { titleBinding: { dataSourceRef: 'advertiser_properties' } },
      view: {},
    })).toBe('advertiser_properties');
  });
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

describe('bound window title resynchronization contract', () => {
  it('observes the active window title after a repeated open command', async () => {
    const source = await import('node:fs/promises').then(({readFile}) => readFile(new URL('./WindowContent.jsx', import.meta.url), 'utf8'));
    expect(source).toContain('[desiredWindowTitle, windowId, window?.windowTitle]');
  });
});

describe('window context runtime identity contract', () => {
  it('reuses a shallow-equal runtime window despite a decorative parent spread', () => {
    const parameters = { conversationId: 'conv-1' };
    const previous = { windowId: 'chat/new', parameters, fillParent: true, isInTab: true };
    const candidate = { windowId: 'chat/new', parameters, fillParent: true, isInTab: true };

    expect(reuseShallowEqualRuntimeObject(previous, candidate)).toBe(previous);
  });

  it('replaces runtime identity when conversation parameters change', () => {
    const previous = { windowId: 'chat/new', parameters: { conversationId: 'conv-1' }, isInTab: true };
    const candidate = { windowId: 'chat/new', parameters: { conversationId: 'conv-2' }, isInTab: true };

    expect(reuseShallowEqualRuntimeObject(previous, candidate)).toBe(candidate);
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

  it('reapplies target overrides to metadata returned by permission compilation', () => {
    const permitted = {
      view: {
        content: {
          table: {columns: [{id: 'desktop'}]},
          targetOverrides: {
            phone: {table: {columns: [{id: 'stacked', type: 'stacked'}]}},
          },
        },
      },
    };
    expect(compilePermissionAppliedMetadata(permitted, {platform: 'web', formFactor: 'phone'}).view.content.table.columns).toEqual([
      {id: 'stacked', type: 'stacked'},
    ]);
  });
});

describe('resolveWindowRootContainer', () => {
  it('merges hosted window parameters into the root view container without mutating metadata', () => {
    const content = {
      id: 'root',
      kind: 'dashboard',
      reportBuilder: {
        title: 'Builder',
      },
      parameters: {
        reportStarterId: '__blank__',
        theme: 'light',
      },
    };

    const resolved = resolveWindowRootContainer(content, {
      reportStarterId: 'performance_inventory_brief',
      prefill: { orderIds: [2680567] },
    });

    expect(resolved).toEqual({
      id: 'root',
      kind: 'dashboard',
      reportBuilder: {
        title: 'Builder',
        prefillReportStarterId: 'performance_inventory_brief',
      },
      parameters: {
        reportStarterId: 'performance_inventory_brief',
        theme: 'light',
        prefill: { orderIds: [2680567] },
      },
    });
    expect(content.parameters.reportStarterId).toBe('__blank__');
    expect(content.reportBuilder.prefillReportStarterId).toBeUndefined();
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
  it('leaves a consumed request inactive until its bindings change or an explicit fetch wakes it', () => {
    const waiting = {inactive: true, loading: false, loaded: false};
    for (let render = 0; render < 100; render++) {
      expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], false, waiting)).toBe(false);
    }
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, waiting)).toBe(true);
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], false, waiting)).toBe(true);
  });
    it('does not re-prime an in-flight empty datasource', () => {
      expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], false, {loaded: false, loading: true})).toBe(false);
    });
  it('settles an automatic failed fetch until Retry or parameters change', () => {
    const error = {message: 'failed'};
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], false, {loaded: false, loading: false, error})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], false, {loaded: false, loading: false, error})).toBe(true);
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, {loaded: false, loading: false, error})).toBe(true);
  });
  it('holds a terminal dataset denial until an explicit fetch is requested', () => {
    const denial = {status: 403, code: 'datasource_denied', scope: 'dataset'};
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, {error: denial})).toBe(false);
    expect(shouldPrimeDataSourceFetch({}, {fetch: true}, [], true, {error: denial})).toBe(true);
  });
  it('does not treat resource or window denials as terminal dataset denials', () => {
    const error = {status: 403, code: 'resource_denied', scope: 'window'};
    expect(shouldPrimeDataSourceFetch({}, {fetch: false}, [], true, {error})).toBe(true);
  });
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

describe('resolveWindowDataSourceFetchFlag', () => {
  it('refetches fetchData-owned datasources when resolved parameters change', () => {
    expect(resolveWindowDataSourceFetchFlag({
      fetchOwnedByContainer: true,
      previousFetch: false,
      shouldFetch: true,
      paramsChanged: true,
    })).toBe(true);
  });

  it('leaves unchanged fetchData-owned datasources to their container', () => {
    expect(resolveWindowDataSourceFetchFlag({
      fetchOwnedByContainer: true,
      previousFetch: false,
      shouldFetch: true,
      paramsChanged: false,
    })).toBe(false);
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


describe('invalid protected metadata', () => {
  it('keeps owner metadata open when presentation snapshot expires', () => {
    expect(compilePermissionAppliedMetadata({authorizationSnapshot:{expiresAt:'2000-01-01T00:00:00Z'},view:{content:{id:'expired'}}}).view.content.id).toBe('expired');
  });
  it('rejects malformed presentation guard syntax', () => {
    const metadata = {authorization:{scope:'window'}, authorizationSnapshot:{authorizationVersion:'v1',expiresAt:'2999-01-01T00:00:00Z'},view:{content:{visibleWhen:{source:'authorization',field:'canRead',unsupported:true}}}};
    expect(() => compilePermissionAppliedMetadata(metadata)).toThrow();
  });
});

describe('owner metadata with presentation-only conditions', () => {
  it('renders resource-scoped metadata without a selected resource or read grant', () => {
    const metadata = {authorization: {scope: 'resource', resource: {type: 'advertiser', id: {source: 'resource', selector: 'Id'}}}, dataSource: {owner: {service: {endpoint: 'owning-mcp'}, parameters: {Id: 42}}}, view: {content: {id: 'owner-frame', containers: [
      {id: 'editor', visibleWhen: {source: 'authorization', field: 'principal.roles', contains: 'editor'}},
      {id: 'history', visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'history'}},
      {id: 'plain'},
    ]}}};
    const first = compilePermissionAppliedMetadata({...metadata, authorizationSnapshot: {principal: {roles: ['editor'], features: []}, resources: {}}});
    expect(first.view.content.id).toBe('owner-frame');
    expect(first.view.content.containers.map(item => item.id)).toEqual(['editor', 'plain']);
    expect(first.dataSource).toEqual(metadata.dataSource);
    const next = compilePermissionAppliedMetadata({...metadata, authorizationSnapshot: {principal: {roles: [], features: ['history']}, resources: {}}});
    expect(next.view.content.containers.map(item => item.id)).toEqual(['history', 'plain']);
    expect(next.dataSource).toEqual(metadata.dataSource);
  });
});
