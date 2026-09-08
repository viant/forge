import assert from 'node:assert/strict';
import {buildFetchCollectionSignal} from './dataSource.js';
import {buildDatasourceFetchPayload} from './datasourceRequest.js';

const signal = buildFetchCollectionSignal({filter: {status: 1}}, {filter: {name: 'A'}, cache: {bypassCache: true}, invocationId: 'cmd-123', bindingGeneration: 'B'});
assert.deepEqual(signal, {filter: {status: 1, name: 'A'}, fetch: true, cache: {bypassCache: true}, invocationId: 'cmd-123', bindingGeneration: 'B'});
assert.deepEqual(buildDatasourceFetchPayload({inputParameters: {Id: [1]}, invocationId: signal.invocationId}), {inputs: {Id: [1]}, invocationId: 'cmd-123'});
console.log('datasource invocation correlation passed');
