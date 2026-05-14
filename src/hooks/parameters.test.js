import assert from 'node:assert/strict';

import { resolveParameters } from './parameters.js';

const baseContext = {
  identity: { dataSourceRef: 'default' },
  dataSources: { default: {}, other: {} },
  signals: {
    windowForm: {
      peek: () => ({
        AdOrderId: [2637048],
        granularity: 'hour',
        periodView: 'today',
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
], baseContext);

assert.deepEqual(resolved, {
  order_id: 2637048,
  granularity: 'hour',
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
