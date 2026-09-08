import assert from 'node:assert/strict';
import {copyDetailValue} from './detailViewModel.js';

assert.equal(await copyDetailValue(null, 'ID', 1), 'Could not copy ID');
assert.equal(await copyDetailValue({writeText: async () => { throw new Error('denied'); }}, 'ID', 1), 'Could not copy ID');
let copied;
assert.equal(await copyDetailValue({writeText: async (value) => { copied = value; }}, 'ID', 1), 'Copied ID');
assert.equal(copied, '1');
console.log('detail view copy feedback passed');
