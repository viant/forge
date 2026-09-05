import assert from 'node:assert/strict';
import {applyFetchTransform} from './dataSourceTransform.js';

const events = {
    onFetch: {
        isDefined: () => true,
        execute: ({collection}) => [...collection, {id: 'derived'}],
    },
};

assert.deepEqual(applyFetchTransform(events, []), [{id: 'derived'}]);
assert.deepEqual(applyFetchTransform({
    onFetch: {
        isDefined: () => true,
        execute: () => undefined,
    },
}, []), []);
assert.deepEqual(applyFetchTransform({onFetch: {isDefined: () => false}}, [{id: 1}]), [{id: 1}]);

console.log('dataSourceTransform ✓ applies transforms to completed empty collections');
