import assert from 'node:assert/strict';
import {resolveTableStackedValue} from './tableStackedValue.js';

assert.deepEqual(resolveTableStackedValue({
  meta: 'Sep 2, 2026 · user',
  title: 'Campaign Updated',
  body: 'A long audit detail',
}), {
  meta: 'Sep 2, 2026 · user',
  title: 'Campaign Updated',
  body: 'A long audit detail',
  expandLabel: 'Expand',
});

console.log('tableStackedValue ✓ normalizes a single-action stacked table cell');
