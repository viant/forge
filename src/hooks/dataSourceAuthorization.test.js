import assert from 'node:assert/strict';
import {useDataSourceHandlers} from './dataSource.js';
import {
  clearProtectedWindowState, getCollectionInfoSignal, getCollectionSignal,
  getControlSignal, getFormSignal, getFormStatusSignal, getInputSignal,
  getMetadataSignal, getSelectionSignal, primeWindowSignals,
  protectedWindowDenials,
} from '../core/store/signals.js';

function fixture(windowId, connector) {
  const sourceId = `${windowId}DSrows`;
  primeWindowSignals(windowId, {dataSource: {rows: {}}});
  getMetadataSignal(windowId).value = {authorizationSnapshot: {authorizationVersion: 'v1'}};
  const signals = {
    control: getControlSignal(sourceId), form: getFormSignal(sourceId),
    selection: getSelectionSignal(sourceId, {selected: null, rowIndex: -1}),
    collection: getCollectionSignal(sourceId), input: getInputSignal(sourceId),
    collectionInfo: getCollectionInfoSignal(sourceId), formStatus: getFormStatusSignal(sourceId),
  };
  const identity = {windowId, dataSourceRef: 'rows', dataSourceId: sourceId, protectedWindow: true};
  const handlers = useDataSourceHandlers(identity, signals, {rows: {selectionMode: 'single', uniqueKey: [{field: 'id'}]}}, connector);
  return {signals, handlers};
}

const denied = fixture('deniedSave', {post: async () => { throw Object.assign(new Error('upstream denied'), {status: 403}); }});
denied.signals.form.value = {name: 'draft'};
denied.signals.collection.value = [{secret: 'old-account'}];
assert.equal(await denied.handlers.handleSave(), false);
assert.equal(protectedWindowDenials.value.deniedSave.status, 403);
assert.equal(getMetadataSignal('deniedSave').value, null);
assert.deepEqual(denied.signals.collection.value, []);
assert.deepEqual(denied.signals.form.value, {});

let complete;
const late = fixture('lateSave', {post: () => new Promise(resolve => { complete = resolve; })});
late.signals.form.value = {name: 'old-account'};
const pending = late.handlers.handleSave();
clearProtectedWindowState('lateSave');
late.signals.form.value = {name: 'new-account'};
complete({ok: true});
assert.equal(await pending, false);
assert.deepEqual(late.signals.form.value, {name: 'new-account'});
assert.equal(late.signals.input.value.fetch, false);

// The server-typed scoped denial keeps the root usable and rejects stale
// reads/saves without restoring denied drafts or dispatching refreshes.
const scoped = fixture('scopedSave', {post:async()=>{throw Object.assign(new Error('denied dataset'),{status:403,code:'datasource_denied',scope:'dataset'});}});
scoped.signals.form.value={secret:'draft'};scoped.signals.collection.value=[{secret:'row'}];
assert.equal(await scoped.handlers.handleSave(),false);
assert.ok(getMetadataSignal('scopedSave').peek());assert.equal(protectedWindowDenials.peek().scopedSave,undefined);
assert.deepEqual(scoped.signals.form.peek(),{});assert.deepEqual(scoped.signals.collection.peek(),[]);
let finishRead;
const staleRead=fixture('scopedLateRead',{get:()=>new Promise(resolve=>{finishRead=resolve;})});
const read=staleRead.handlers.fetchRecords();
const {clearDeniedDataSourceState}=await import('../core/store/signals.js');
clearDeniedDataSourceState('scopedLateReadDSrows',{status:403,code:'datasource_denied',scope:'dataset'});
finishRead({data:[{secret:'late'}]});
await assert.rejects(read,error=>error.code==='request_superseded');
let finishSave;
const staleSave=fixture('scopedLateSave',{post:()=>new Promise(resolve=>{finishSave=resolve;})});
staleSave.signals.form.value={secret:'draft'};const write=staleSave.handlers.handleSave();
clearDeniedDataSourceState('scopedLateSaveDSrows',{status:403,code:'datasource_denied',scope:'dataset'});
finishSave({ok:true});assert.equal(await write,false);assert.equal(staleSave.signals.input.peek().fetch,false);
assert.deepEqual(staleSave.signals.form.peek(),{});
