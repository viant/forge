import assert from 'node:assert/strict';
import {isRowSelectionDisabled} from './rowSelection.js';

const condition = {source: 'row', field: 'status', in: [1, 4]};
assert.equal(isRowSelectionDisabled(condition, {status: 1}), true);
assert.equal(isRowSelectionDisabled(condition, {status: 4}), true);
assert.equal(isRowSelectionDisabled(condition, {status: 2}), false);
assert.equal(isRowSelectionDisabled(condition, {}), false);
assert.equal(isRowSelectionDisabled(null, {status: 1}), false);

console.log('row selection tests passed');
