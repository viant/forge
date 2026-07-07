import assert from 'node:assert/strict';

import {
  createKeyListSignature,
  reconcileVisibleColumns,
  reconcileSelectedDataKeys,
  resolveSelectedValueKey,
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

assert.equal(
  resolveSelectedValueKey('clicks', {
    valueKey: 'spend',
    values: [{ value: 'spend' }, { value: 'clicks' }],
  }, []),
  'clicks',
);

assert.equal(
  resolveSelectedValueKey('legacy', {
    valueKey: 'spend',
    values: [{ value: 'spend' }, { value: 'clicks' }],
  }, []),
  'spend',
);

assert.equal(
  resolveSelectedValueKey('', {
    values: [{ value: 'spend' }, { value: 'clicks' }],
  }, []),
  'spend',
);

assert.equal(
  resolveSelectedValueKey('', {}, [{ value: 'reachRate' }]),
  'reachRate',
);

assert.equal(
  resolveSelectedValueKey('legacy', {}, []),
  '',
);

assert.equal(createKeyListSignature([' spend ', 'clicks', 'spend']), 'spend\u0001clicks');

const existingVisibleColumns = ['eventDate', 'spend'];
assert.equal(
  reconcileVisibleColumns(existingVisibleColumns, ['eventDate', 'spend']),
  existingVisibleColumns,
);
assert.deepEqual(
  reconcileVisibleColumns(['eventDate'], ['eventDate', 'spend']),
  ['eventDate', 'spend'],
);
