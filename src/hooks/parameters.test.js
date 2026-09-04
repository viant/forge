import assert from 'node:assert/strict';

import { applyParameterCodec, resolveParameters } from './parameters.js';

assert.equal(applyParameterCodec('8', { name: 'int' }), 8);
assert.equal(applyParameterCodec('8.5', { name: 'number' }), 8.5);
assert.equal(applyParameterCodec('false', { name: 'boolean' }), false);
assert.deepEqual(applyParameterCodec(['1', 2], { name: 'int[]' }), [1, 2]);
assert.equal(applyParameterCodec('not-an-int', { name: 'int' }), 'not-an-int');

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
