import assert from 'node:assert/strict';
import {shouldInitializeEmptyTable} from './tableInitialization.js';

assert.equal(shouldInitializeEmptyTable([], [], {loaded: false, loading: false}), true);
assert.equal(shouldInitializeEmptyTable([], [], {loaded: false, loading: true}), false);
assert.equal(shouldInitializeEmptyTable([], [], {loaded: true, loading: false}), false);
assert.equal(shouldInitializeEmptyTable([], [], {inactive: true}), false);
assert.equal(shouldInitializeEmptyTable([], [], {loaded: false, loading: false, error: {status: 403, code: 'datasource_denied', scope: 'dataset'}}), false);
assert.equal(shouldInitializeEmptyTable([], [], {loaded: false, loading: false, error: {status: 403, code: 'resource_denied', scope: 'window'}}), true);
assert.equal(shouldInitializeEmptyTable([], [], {loaded: false, loading: false, error: {message: 'temporary read failure'}}), true);
assert.equal(shouldInitializeEmptyTable([{id: 1}], [], {}), false);
assert.equal(shouldInitializeEmptyTable([], [{id: 1}], {}), false);

console.log('table initialization state passed');
