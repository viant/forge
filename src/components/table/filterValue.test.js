import assert from 'node:assert/strict';
import {normalizeSubmittedFilterValue} from './filterValue.js';

assert.deepEqual(normalizeSubmittedFilterValue({type: 'int[]'}, '405', 'server'), [405]);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]'}, 'Active', 'server'), ['Active']);
assert.equal(normalizeSubmittedFilterValue({type: 'int'}, '405', 'server'), 405);
assert.equal(normalizeSubmittedFilterValue({type: 'int[]'}, 'bad', 'server')[0], 'bad');
assert.equal(normalizeSubmittedFilterValue({type: 'int[]'}, '405', 'client'), '405');
console.log('PASS: server filters honor authored codecs without changing client filters');
