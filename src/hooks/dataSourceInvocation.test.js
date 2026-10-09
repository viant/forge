import assert from 'node:assert/strict';
import {buildFetchCollectionSignal} from './dataSource.js';
import {buildDatasourceFetchPayload} from './datasourceRequest.js';

const signal = buildFetchCollectionSignal({filter: {status: 1}}, {filter: {name: 'A'}, cache: {bypassCache: true}, invocationId: 'cmd-123', bindingGeneration: 'B'});
assert.deepEqual(signal, {filter: {status: 1, name: 'A'}, fetch: true, cache: {bypassCache: true}, invocationId: 'cmd-123', bindingGeneration: 'B'});
assert.deepEqual(buildDatasourceFetchPayload({inputParameters: {Id: [1]}, invocationId: signal.invocationId}), {inputs: {Id: [1]}, invocationId: 'cmd-123'});
console.log('datasource invocation correlation passed');

// A dialog reopening owns a fresh filter seed, including an empty seed. A
// collection fetch elsewhere still merges partial filters as before.
assert.deepEqual(buildFetchCollectionSignal({filter: {AdOrderId: '2705049'}}, {filter: {}, replaceFilter: true}).filter, {});
assert.deepEqual(buildFetchCollectionSignal({filter: {AdOrderId: '2705049', AdOrderName: 'old'}}, {filter: {AdOrderName: 'new'}, replaceFilter: true}).filter, {AdOrderName: 'new'});
assert.deepEqual(buildFetchCollectionSignal({filter: {AdOrderId: '2705049'}}, {filter: {AdOrderName: 'new'}}).filter, {AdOrderId: '2705049', AdOrderName: 'new'});
