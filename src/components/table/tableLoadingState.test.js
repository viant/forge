import assert from 'node:assert/strict';
import {tableLoadingMode} from './tableLoadingState.js';

assert.equal(tableLoadingMode({loading: true, rowCount: 0}), 'initial');
assert.equal(tableLoadingMode({loading: true, rowCount: 52}), 'refresh');
assert.equal(tableLoadingMode({loading: true, error: new Error('failed'), rowCount: 52}), 'idle');
assert.equal(tableLoadingMode({loading: false, rowCount: 52}), 'idle');

console.log('table loading presentation state passed');
