import assert from 'node:assert/strict';
import {applyClientFilters} from './clientFilters.js';

const rows = [
    {id: 1, name: 'Syed Tests', radius: 15},
    {id: 2, name: 'Other', radius: 25},
];
const filterSet = {template: [
    {id: 'Name', field: 'name', operator: 'contains'},
    {id: 'Radius', field: 'radius', operator: 'equal'},
]};

assert.deepEqual(applyClientFilters(rows, filterSet, {Name: 'syed'}).map((row) => row.id), [1]);
assert.deepEqual(applyClientFilters(rows, filterSet, {Radius: '25'}).map((row) => row.id), [2]);
assert.deepEqual(applyClientFilters(rows, filterSet, {}).map((row) => row.id), [1, 2]);

console.log('client filters ✓ bounded collections filter without transport');
