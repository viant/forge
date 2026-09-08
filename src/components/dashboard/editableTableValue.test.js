import assert from 'node:assert/strict';
import {editableNumberValue} from './editableTableValue.js';

assert.equal(editableNumberValue(''), '', 'clear must remain an editable intermediate state');
assert.equal(editableNumberValue('0'), 0, 'an intentional zero must remain numeric');
assert.equal(editableNumberValue('1.11'), 1.11, 'the value typed after clearing must be committed');

console.log('editable table numeric value model ✓');

