import assert from 'node:assert/strict';
import {beginDataSourceRequest, settleDataSourceRequest} from './dataSourceRequestLifecycle.js';

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
