import assert from 'node:assert/strict';

import {
  busSignals,
  findBusSignal,
  findMetricsSignal,
  findViewSignal,
  getBusSignal,
  getMetricsSignal,
  getViewSignal,
  getMetadataSignal,
  findMetadataSignal,
  getFormSignal,
  getCollectionSignal,
  clearProtectedWindowState,
  denyProtectedWindow,
  clearProtectedWindowDenial,
  protectedWindowDenials,
  removeSignalsForKey,
  primeWindowSignals,
  protectedWindowEpoch,
  metricsSignals,
  viewSignals,
} from './signals.js';
import {beginDataSourceRequest, settleDataSourceRequest} from '../../components/dataSourceRequestLifecycle.js';

busSignals.value = {};
metricsSignals.value = {};
viewSignals.value = {};

assert.equal(findBusSignal('W1'), null);
assert.equal(findMetricsSignal('W1DSmetrics'), null);
assert.equal(findViewSignal('W1'), null);

assert.deepEqual(Object.keys(busSignals.peek()), []);
assert.deepEqual(Object.keys(metricsSignals.peek()), []);
assert.deepEqual(Object.keys(viewSignals.peek()), []);

const busSignal = getBusSignal('W1');
const metricsSignal = getMetricsSignal('W1DSmetrics');
const viewSignal = getViewSignal('W1');

assert.ok(busSignal);
assert.ok(metricsSignal);
assert.ok(viewSignal);

assert.equal(findBusSignal('W1'), busSignal);
assert.equal(findMetricsSignal('W1DSmetrics'), metricsSignal);
assert.equal(findViewSignal('W1'), viewSignal);

const protectedMetadata = getMetadataSignal('protected');
protectedMetadata.value = {authorizationSnapshot: {authorizationVersion: 'v1'}};
getFormSignal('protected:windowForm').value = {draft: 'old-account'};
getCollectionSignal('protectedDSrows').value = [{secret: true}];
const overlappingMetadata = getMetadataSignal('protectedDSchild');
overlappingMetadata.value = {authorizationSnapshot: {authorizationVersion: 'child'}};
primeWindowSignals('protectedDSchild', {dataSource: {rows: {}}});
getCollectionSignal('protectedDSchildDSrows').value = [{safe: true}];
getFormSignal('protectedDSchild:windowForm').value = {draft: 'child-account'};
const otherForm = getFormSignal('other:windowForm');
otherForm.value = {draft: 'other-account'};
const previousEpoch = protectedWindowEpoch('protected');
const staleRequest = beginDataSourceRequest('protectedDSrows', 'old-account', 'protected');
const otherRequest = beginDataSourceRequest('otherDSrows', 'current-account', 'other');
const overlappingWindowRequest = beginDataSourceRequest('protectedDSchildDSrows', 'independent', 'protectedDSchild');
clearProtectedWindowState('protected');
assert.notEqual(protectedWindowEpoch('protected'), previousEpoch);
await assert.rejects(staleRequest, error => error?.code === 'request_superseded');
assert.equal(settleDataSourceRequest('otherDSrows', 'current-account', null, {ok: true}), true);
assert.deepEqual(await otherRequest, {ok: true});
assert.equal(settleDataSourceRequest('protectedDSchildDSrows', 'independent', null, {ok: true}), true);
assert.deepEqual(await overlappingWindowRequest, {ok: true});
assert.equal(protectedMetadata.value, null);
assert.deepEqual(getFormSignal('protected:windowForm').value, {});
assert.deepEqual(getCollectionSignal('protectedDSrows').value, []);
assert.deepEqual(otherForm.value, {draft: 'other-account'});
assert.equal(overlappingMetadata.value.authorizationSnapshot.authorizationVersion, 'child');
assert.deepEqual(getCollectionSignal('protectedDSchildDSrows').value, [{safe: true}]);
assert.deepEqual(getFormSignal('protectedDSchild:windowForm').value, {draft: 'child-account'});
removeSignalsForKey('protected');
assert.equal(findMetadataSignal('protected'), null);
assert.equal(findMetadataSignal('protectedDSchild'), overlappingMetadata);
assert.deepEqual(getCollectionSignal('protectedDSchildDSrows').value, [{safe: true}]);
denyProtectedWindow('protectedDSchild', 403);
assert.equal(protectedWindowDenials.value.protectedDSchild.status, 403);
assert.equal(getMetadataSignal('protectedDSchild').value, null);
assert.deepEqual(getCollectionSignal('protectedDSchildDSrows').value, []);
assert.equal(otherForm.value.draft, 'other-account');
clearProtectedWindowDenial('protectedDSchild');
assert.equal(protectedWindowDenials.value.protectedDSchild, undefined);

// A typed datasource denial leaves filters/window and sibling results intact,
// while invalidating denied drafts and pending completions only.
const scoped = await import('./signals.js');
const ds='scopedDSrows',other='scopedDSother';
scoped.getMetadataSignal('scoped').value={authorizationSnapshot:{authorizationVersion:'current'}};
scoped.getCollectionSignal(ds).value=[{secret:'denied'}];scoped.getFormSignal(ds).value={secret:'draft'};
scoped.getCollectionSignal(other).value=[{allowed:true}];scoped.getFormSignal(other).value={allowed:'draft'};
scoped.getInputSignal(ds).value={filter:{Name:'failed'},fetch:true,parameters:{request:{filters:{category:'user-selected'}}},args:[{original:'request'}],cache:{secret:'cached-row'}};
scoped.getFormSignal('scoped:windowForm').value={selectedCategory:'user-selected'};
const windowEpoch=scoped.protectedWindowEpoch('scoped'),dsEpoch=scoped.protectedDataSourceEpoch(ds);
const deniedPending=beginDataSourceRequest(ds,'late','scoped'),otherPending=beginDataSourceRequest(other,'live','scoped');
const denial={status:403,code:'datasource_denied',scope:'dataset'};scoped.clearDeniedDataSourceState(ds,denial);
await assert.rejects(deniedPending,error=>error.code==='datasource_denied' && error.status===403 && error.scope==='dataset');
assert.equal(settleDataSourceRequest(ds,'late',null,{secret:'stale'}),false);
assert.equal(settleDataSourceRequest(other,'live',null,'allowed'),true);assert.equal(await otherPending,'allowed');
assert.deepEqual(scoped.getCollectionSignal(ds).peek(),[]);assert.deepEqual(scoped.getFormSignal(ds).peek(),{});
assert.deepEqual(scoped.getCollectionSignal(other).peek(),[{allowed:true}]);assert.deepEqual(scoped.getFormSignal(other).peek(),{allowed:'draft'});
assert.deepEqual(scoped.getInputSignal(ds).peek().filter,{Name:'failed'});assert.deepEqual(scoped.getInputSignal(ds).peek().parameters,{request:{filters:{category:'user-selected'}}});
assert.deepEqual(scoped.getInputSignal(ds).peek().args,[{original:'request'}]);
assert.equal(scoped.getInputSignal(ds).peek().cache,null);
assert.equal(scoped.protectedWindowEpoch('scoped'),windowEpoch);assert.equal(scoped.protectedDataSourceEpoch(ds),dsEpoch+1);
assert.deepEqual(scoped.getFormSignal('scoped:windowForm').peek(),{selectedCategory:'user-selected'});
assert.ok(scoped.getMetadataSignal('scoped').peek());assert.equal(scoped.protectedWindowDenials.peek().scoped,undefined);
