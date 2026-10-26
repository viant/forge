import assert from 'node:assert/strict';
import {normalizeSubmittedFilterValue} from './filterValue.js';

assert.deepEqual(normalizeSubmittedFilterValue({type: 'int[]'}, '405', 'server'), [405]);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]'}, 'Active', 'server'), ['Active']);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]'}, 'Universal Pixel,Retargeting Pixel', 'server', {textInput: true}), ['Universal Pixel','Retargeting Pixel']);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]'}, '"First, Kind",Second', 'server', {textInput: true}), ['First, Kind','Second']);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]'}, ['First, Kind'], 'server', {textInput: true}), ['First, Kind']);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'string[]',options:[{value:'First, Kind'}]}, 'First, Kind', 'server'), ['First, Kind']);
assert.deepEqual(normalizeSubmittedFilterValue({type: 'int[]'}, '405, 406', 'server', {textInput: true}), [405,406]);
assert.equal(normalizeSubmittedFilterValue({type: 'int'}, '405', 'server'), 405);
assert.equal(normalizeSubmittedFilterValue({type: 'int[]'}, 'bad', 'server')[0], 'bad');
assert.equal(normalizeSubmittedFilterValue({type: 'int[]'}, '405', 'client'), '405');
console.log('PASS: server filters honor authored codecs without changing client filters');
