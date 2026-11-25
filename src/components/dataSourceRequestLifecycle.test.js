import assert from 'node:assert/strict';
import {beginDataSourceRequest, invalidateWindowDataSourceRequests, retainMutationAcknowledgement, settleDataSourceRequest, settleUnmountedDataSourceResponse} from './dataSourceRequestLifecycle.js';

const first = beginDataSourceRequest('records', 'A');
assert.equal(beginDataSourceRequest('records', 'A'), first);
assert.equal(settleDataSourceRequest('records', 'A', null, {ok: true}), true);
assert.deepEqual(await first, {ok: true});
const failed = beginDataSourceRequest('records', 'B');
settleDataSourceRequest('records', 'B', new Error('bad'));
await assert.rejects(failed, /bad/);
console.log('datasource request lifecycle passed');
const normalized = beginDataSourceRequest('records', 'C', 'window', 'records');
const rows = [{id: 1, name: 'Selected'}];
settleDataSourceRequest('records', 'C', null, {data: rows}, rows);
rows[0].name = 'Later response';
assert.deepEqual(await normalized, [{id: 1, name: 'Selected'}]);
const superseded = beginDataSourceRequest('records', 'D', 'window', 'records');
settleDataSourceRequest('records', 'D', null, {data: []});
await assert.rejects(superseded, /superseded/);

const ordinaryRead = beginDataSourceRequest('source', 'read');
assert.equal(retainMutationAcknowledgement('source', 'read', Promise.resolve()), false);
settleUnmountedDataSourceResponse('source', 'read', {}, true);
await assert.rejects(ordinaryRead, {code: 'request_superseded'});

const modeledWrite = beginDataSourceRequest('source', 'validation');
assert.equal(retainMutationAcknowledgement('source', 'validation', modeledWrite), true);
settleUnmountedDataSourceResponse('source', 'validation', {}, false);
await assert.rejects(modeledWrite, {code: 'request_superseded'});

const revoked = beginDataSourceRequest('source', 'old', 'original-window');
assert.equal(retainMutationAcknowledgement('source', 'old', revoked), true);
assert.equal(invalidateWindowDataSourceRequests('original-window'), 1);
assert.equal(settleUnmountedDataSourceResponse('source', 'old', {}, true), false);
await assert.rejects(revoked, {code: 'request_superseded'});
