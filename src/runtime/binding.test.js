import assert from 'node:assert/strict';

import { resolveStateAdapter } from './binding.js';

function signalState(value, peekValue) {
  return {
    value,
    peek() {
      return peekValue;
    },
  };
}

const inputAdapter = resolveStateAdapter('input')(
  {
    signals: {
      input: signalState({ nested: { actual: 'reactive' } }, { nested: { actual: 'stale' } }),
    },
  },
  { dataField: 'nested.actual' },
);
assert.equal(inputAdapter.get(), 'reactive');

const selectionAdapter = resolveStateAdapter('selection')(
  {
    signals: {
      selection: signalState({ selected: { id: 'live' } }, { selected: { id: 'stale' } }),
    },
  },
  { dataField: 'selected.id' },
);
assert.equal(selectionAdapter.get(), 'live');

const metricsAdapter = resolveStateAdapter('metrics')(
  {
    signals: {
      metrics: signalState({ summary: { spend: 91.2 } }, { summary: { spend: 0 } }),
    },
  },
  { dataField: 'summary.spend' },
);
assert.equal(metricsAdapter.get(), 91.2);

const windowFormAdapter = resolveStateAdapter('windowForm')(
  {
    signals: {
      windowForm: signalState({ periodView: '7d' }, { periodView: 'today' }),
    },
  },
  { dataField: 'periodView' },
);
assert.equal(windowFormAdapter.get(), '7d');

const collectionAdapter = resolveStateAdapter('collection')(
  {
    signals: {
      collection: signalState(
        [{ total: 5 }, { total: 7 }],
        [{ total: 0 }],
      ),
    },
  },
  { dataField: 'total', aggregate: 'sum' },
);
assert.equal(collectionAdapter.get(), 12);

console.log('binding adapters ✓ signal-backed getters use reactive values');
