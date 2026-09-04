import assert from 'node:assert/strict';
import {reconcileMultiSelection} from './dataSourceSelection.js';

const uniqueKey = (row) => row?.id;

assert.deepEqual(
    reconcileMultiSelection({selection: [{id: 7}]}, [], uniqueKey),
    {selection: []},
);

const refreshed = [{id: 2, name: 'current'}, {id: 3, name: 'new'}];
const result = reconcileMultiSelection(
    {selection: [{id: 1}, {id: 2, name: 'stale'}]},
    refreshed,
    uniqueKey,
);
assert.deepEqual(result, {selection: [{id: 2, name: 'current'}]});
assert.equal(result.selection[0], refreshed[0]);

console.log('dataSourceSelection ✓ reconciles multi-selection against refreshed rows');
