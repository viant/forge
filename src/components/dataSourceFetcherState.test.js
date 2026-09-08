import assert from 'node:assert/strict';
import {shouldFetchDataSourceOnMount} from './dataSourceFetcherState.js';

assert.equal(shouldFetchDataSourceOnMount({fetchData: false}), false);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, control: {loading: true}}), false);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, fetchOnce: true, control: {loaded: true}}), false);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, fetchOnce: true, control: {loaded: false, error: {message: 'failed'}}}), false);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, fetchOnce: false, control: {loaded: true}}), true);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, fetchOnce: false, control: {loaded: false, error: {message: 'failed'}}}), true);
assert.equal(shouldFetchDataSourceOnMount({fetchData: true, fetchOnce: true, control: {loaded: false}}), true);

console.log('data source fetcher mount state passed');
