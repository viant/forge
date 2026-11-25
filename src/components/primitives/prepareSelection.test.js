import assert from 'node:assert/strict';
import test from 'node:test';
import {openPreparedSelection} from './prepareSelection.js';
import {getDialogSignal} from '../../core/store/signals.js';

let counter = 0;
function fixture() {
  const windowId = 'selected-records-' + ++counter;
  const form = {value: {parent: 8}, peek() {return this.value;}};
  const selection = {value: {selection: [{id: '9007199254740993'}, {id: '002'}]}, peek() {return this.value;}};
  const rows = [{id: 2, parent: '8', kind: 'one'}, {id: '9007199254740993', parent: 8, kind: 'one'}];
  const events = [];
  const calls = {};
  const descriptor = {modelRef: 'm', model: {schemaRef: 's'}, schema: {properties: {}}, values: {editable: true}};
  const operation = {id: 'edit', dialogId: 'editor', parameters: [{name: 'Parent', in: 'windowForm', location: 'parent', codec: {name: 'int[]'}}],
    prepareSelection: {dataSourceRef: 'read', idsParameter: 'IDs', identityField: 'id', scopeFields: {parent: 'Parent'},
      mappingRef: 'records', prepare: 'prepare', pendingField: 'opening', errorField: 'error'}};
  const context = {
    identity: {windowId}, authorization: {subject: 'user'}, signals: {windowForm: form, selection},
    metadata: {dialogs: [{id: 'editor', dataSourceRef: 'draft'}], dataSource: {read: {}, draft: {resourceModelRef: 'draftModel'}},
      resourceMappings: {records: {selectors: ['kind'], cases: {unrelated: {}}, fieldOrder: ['field']}},
      resourceModels: {draftModel: {fields: {options: {default: ['a']}}}}},
    Context(ref) {
      if (ref === 'read') return {handlers: {dataSource: {fetchRecords: async ({parameters, cache, invocationId}) => {
        events.push('read'); calls.input = parameters; calls.cache = cache; calls.invocationId = invocationId; return calls.read ? calls.read() : {data: rows};
      }}}};
      if (ref === 'draft') return {handlers: {dataSource: {setEditedFormData: ({values}) => {calls.form = values; events.push('seed');}}}};
    },
    lookupHandler() {return args => {calls.args = args; events.push('prepare'); return {ids: args.rows.map(v => v.id)};};},
    resolveMappedResource() {return descriptor;},
    handlers: {window: {openDialog() {events.push('open');}}},
  };
  const open = () => openPreparedSelection(context, operation, current => current.signals.windowForm.peek()?.opening !== true);
  return {context, open, events, calls, form, selection, rows, operation, descriptor};
}

test('one detached read preserves row order, checks parent and supplies only selected models', async () => {
  const f = fixture();
  assert.equal((await f.open()).status, 'opened');
  assert.deepEqual(f.events, ['read','prepare','seed','open']);
  assert.deepEqual(f.calls.cache, {bypassCache: true});
  assert.equal(f.calls.args.invocationId, f.calls.invocationId);
  assert.deepEqual(f.calls.input, {Parent: [8], IDs: ['9007199254740993', '002']});
  assert.deepEqual(f.calls.form.ids, ['9007199254740993',2]);
  assert.deepEqual(f.calls.args.rowCases, [0,0]);
  assert.deepEqual(f.calls.args.descriptors, [f.descriptor]);
  assert.deepEqual(f.calls.args.mapping, {fieldOrder:['field'], uploads:{}});
  assert.equal(f.calls.args.draftModel.fields.options.default[0],'a');
  f.calls.args.descriptors[0].values.editable = false;
  assert.equal(f.descriptor.values.editable, true);
  assert.equal(f.form.value.opening, false);
});

test('invalid selection or missing parent fails before the read', async () => {
  for (const ids of [[], [''], [2,'002'], [true], [Number.MAX_SAFE_INTEGER + 1]]) {
    const f = fixture();
    f.selection.value = {selection: ids.map(id => ({id}))};
    assert.equal((await f.open()).status, 'failed'); assert.deepEqual(f.events, []);
  }
  const f = fixture(); f.form.value.parent = undefined;
  assert.equal((await f.open()).status, 'failed'); assert.deepEqual(f.events, []);
});

test('missing, duplicate, extra and foreign records preserve the old draft', async () => {
  for (const reply of [[], [{id:2,parent:8},{id:2,parent:8}], [{id:3,parent:8},{id:4,parent:8}],
    [{id:2,parent:8},{id:'9007199254740993',parent:9}], {unexpected:true}]) {
    const f = fixture(); f.calls.read = () => ({data:reply});
    assert.equal((await f.open()).status, 'failed'); assert.deepEqual(f.events, ['read']);
    assert.ok(f.form.value.error); assert.equal(f.form.value.opening, false);
  }
});

test('double click and scope changes during read never publish a stale draft or error', async () => {
  for (const change of ['selection','parent','authorization','opened','reopened']) {
    const f = fixture();
    let release; f.calls.read = () => new Promise(resolve => { release=resolve; });
    const first = f.open();
    assert.equal((await f.open()).status, 'suppressed');
    if (change === 'selection') f.selection.value = {selection: [{id:null}]};
    if (change === 'parent') f.form.value = {...f.form.value, parent:9};
    if (change === 'authorization') f.context.authorization = {subject:'new'};
    if (change === 'opened' || change === 'reopened') {
      const dialog = getDialogSignal(f.context.identity.windowId+'Dialogeditor');
      dialog.value = {open: change === 'opened', props: {}};
    }
    release({data:f.rows});
    assert.equal((await first).status,'superseded'); assert.deepEqual(f.events,['read']);
    assert.equal(f.form.value.error,''); assert.equal(f.form.value.opening,false);
  }
});

test('reader error identity is retained and a later attempt can succeed', async () => {
  const f = fixture(), cause = Object.assign(new Error('Unavailable'), {status:503});
  f.calls.read = () => {throw cause;};
  const failed = await f.open();
  assert.equal(failed.error,cause); assert.match(f.form.value.error,/temporarily unavailable/);
  delete f.calls.read; assert.equal((await f.open()).status,'opened');
});

test('a refused dialog presentation restores its previous draft', async () => {
  const f = fixture(), source = f.context.Context.bind(f.context), previous = {other: true};
  let form = previous;
  f.context.Context = ref => ref === 'draft' ? {handlers: {dataSource: {
    getFormData: () => form, setEditedFormData({values}) {form = values;},
  }}} : source(ref);
  f.context.handlers.window.openDialog = () => false;
  assert.equal((await f.open()).status,'suppressed');
  assert.equal(form,previous);
});

test('preparation cannot publish changes to a live window signal', async () => {
  const f = fixture();
  f.context.lookupHandler = () => ({context}) => {
    context.signals.windowForm.value = {parent: 99};
    return {};
  };
  assert.equal((await f.open()).status, 'failed');
  assert.equal(f.form.value.parent, 8);
  assert.deepEqual(f.events, ['read']);
});
