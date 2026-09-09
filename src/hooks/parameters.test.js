import assert from 'node:assert/strict';

import { applyDataSourceParameterCodecs, applyParameterCodec, resolveParameters } from './parameters.js';

assert.equal(applyParameterCodec('8', { name: 'int' }), 8);
assert.equal(applyParameterCodec('8.5', { name: 'number' }), 8.5);
assert.equal(applyParameterCodec('false', { name: 'boolean' }), false);
assert.deepEqual(applyParameterCodec(['1', 2], { name: 'int[]' }), [1, 2]);
assert.equal(applyParameterCodec(['532743'], { name: 'int' }), 532743);
assert.deepEqual(applyParameterCodec(['1', '2'], { name: 'int' }), ['1', '2']);
assert.equal(applyParameterCodec('not-an-int', { name: 'int' }), 'not-an-int');
assert.deepEqual(applyDataSourceParameterCodecs(
  {CampaignId: ['532743'], filters: {currencyId: ['0']}},
  [{name: 'CampaignId', codec: {name: 'int'}}, {name: 'filters.currencyId', codec: {name: 'int'}}],
), {CampaignId: 532743, filters: {currencyId: 0}});

const baseContext = {
  identity: { dataSourceRef: 'default' },
  dataSources: { default: {}, other: {} },
  signals: {
    windowForm: {
      peek: () => ({
        AdOrderId: [2637048],
        granularity: 'hour',
        periodView: 'today',
        publisherId: '8',
        lineForecastRequest: {From: '2026-09-08T00:00:00Z', IncludeChannelv2: [6], ExcludeZip: ['56788']},
      }),
    },
  },
  Context(ref) {
    return {
      ...this,
      identity: { dataSourceRef: ref },
    };
  },
  handlers: {
    dataSource: {
      peekFormData: () => ({}),
      peekSelection: () => ({ selected: null }),
      peekFilter: () => ({}),
    },
  },
};

const resolved = resolveParameters([
  { name: 'order_id', in: 'windowForm', location: 'AdOrderId.0' },
  { name: 'granularity', in: 'windowForm', location: 'granularity' },
  { name: 'publisherId', in: 'windowForm', location: 'publisherId', codec: { name: 'int' } },
], baseContext);

assert.deepEqual(resolved, {
  order_id: 2637048,
  granularity: 'hour',
  publisherId: 8,
});

assert.deepEqual(resolveParameters([
  {name: '...', in: 'windowForm', location: 'lineForecastRequest'},
], baseContext), {
  From: '2026-09-08T00:00:00Z',
  IncludeChannelv2: [6],
  ExcludeZip: ['56788'],
});

const filterContext = {
  ...baseContext,
  handlers: {
    dataSource: {
      ...baseContext.handlers.dataSource,
      peekFilter: () => ({ Search: 'bid range' }),
    },
  },
  Context(ref) {
    assert.equal(ref, 'default', 'an unqualified filter location must stay on the current datasource');
    return this;
  },
};
assert.deepEqual(resolveParameters([
  { name: 'Search', in: 'filter', location: 'Search' },
], filterContext), { Search: 'bid range' });

const crossDataSourceContext = {
  identity: { dataSourceRef: 'runs' },
  dataSources: { runs: {}, schedules: {} },
  signals: {
    windowForm: {
      peek: () => ({}),
    },
  },
  Context(ref) {
    const selections = {
      schedules: { selected: { id: 'sched-1' } },
      runs: { selected: { id: 'run-1' } },
    };
    return {
      ...this,
      identity: { dataSourceRef: ref },
      dataSource: { selectionMode: 'single' },
      handlers: {
        dataSource: {
          peekFormData: () => ({}),
          peekSelection: () => selections[ref] || { selected: null },
          peekFilter: () => ({}),
        },
      },
    };
  },
  handlers: {
    dataSource: {
      peekFormData: () => ({}),
      peekSelection: () => ({ selected: { id: 'run-1' } }),
      peekFilter: () => ({}),
    },
  },
};

const crossResolved = resolveParameters([
  { name: 'scheduleId', in: 'selection', location: 'schedules.id' },
  { name: 'requireScheduleId', in: 'const', location: 'true' },
], crossDataSourceContext);

assert.deepEqual(crossResolved, {
  scheduleId: 'sched-1',
  requireScheduleId: 'true',
});
