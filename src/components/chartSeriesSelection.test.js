import assert from 'node:assert/strict';

import {
  reconcileSelectedDataKeys,
  toggleSelectedDataKey,
} from './chartSeriesSelection.js';

assert.deepEqual(
  reconcileSelectedDataKeys([], ['spend', 'clicks'], { initialized: false, touched: false }),
  {
    selectedDataKeys: ['spend', 'clicks'],
    initialized: true,
  },
);

assert.deepEqual(
  reconcileSelectedDataKeys([], [], { initialized: false, touched: false }),
  {
    selectedDataKeys: [],
    initialized: false,
  },
);

assert.deepEqual(
  reconcileSelectedDataKeys(['spend'], ['spend', 'clicks'], { initialized: true, touched: false }),
  {
    selectedDataKeys: ['spend', 'clicks'],
    initialized: true,
  },
);

assert.deepEqual(
  reconcileSelectedDataKeys([], ['spend', 'clicks'], { initialized: true, touched: true }),
  {
    selectedDataKeys: [],
    initialized: true,
  },
);

assert.deepEqual(
  reconcileSelectedDataKeys(['spend', 'legacy'], ['spend', 'clicks'], { initialized: true, touched: true }),
  {
    selectedDataKeys: ['spend'],
    initialized: true,
  },
);

assert.deepEqual(toggleSelectedDataKey(['spend', 'clicks'], 'clicks'), ['spend']);
assert.deepEqual(toggleSelectedDataKey(['spend'], 'clicks'), ['spend', 'clicks']);
