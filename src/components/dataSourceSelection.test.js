import assert from 'node:assert/strict';
import {pageSelectionPolicy, reconcileMultiSelection, reconcileSingleSelection} from './dataSourceSelection.js';

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
assert.deepEqual(
    reconcileMultiSelection({selection: [{id: 1, name: 'page one'}, {id: 2, name: 'stale'}]}, refreshed, uniqueKey, {retainMissing: true}),
    {selection: [{id: 1, name: 'page one'}, {id: 2, name: 'current'}]},
);
const query = (page, filter = {}, parameters = {OrderId: [7]}) => JSON.stringify({page, filter, parameters, sort: [], pageSize: 10});
assert.deepEqual(pageSelectionPolicy(query(1), query(2)), {retainMissing: true, clear: false});
assert.deepEqual(pageSelectionPolicy(query(1), query(1)), {retainMissing: false, clear: false});
assert.deepEqual(pageSelectionPolicy(query(1), query(2, {Name: 'other'})), {retainMissing: false, clear: true});
assert.deepEqual(pageSelectionPolicy(query(1), query(2, {}, {OrderId: [8]})), {retainMissing: false, clear: true});

console.log('dataSourceSelection ✓ reconciles multi-selection against refreshed rows');

assert.deepEqual(
    reconcileSingleSelection({selected: {id: 7}, rowIndex: 0}, [], uniqueKey),
    {selected: null, rowIndex: -1},
);
assert.deepEqual(
    reconcileSingleSelection({selected: {id: 2, name: 'stale'}, rowIndex: 4}, refreshed, uniqueKey),
    {selected: refreshed[0], rowIndex: 0},
);

console.log('dataSourceSelection ✓ reconciles single-selection by key without shifting rows');
