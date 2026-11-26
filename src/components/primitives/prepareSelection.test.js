import assert from 'node:assert/strict';
import test from 'node:test';
import {openPreparedSelection} from './prepareSelection.js';
import {admitParentRead, recordParentRead} from '../../runtime/parentPreparation.js';
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

function parentFixture() {
  const f = fixture();
  const {context, operation, form, selection} = f;
  operation.parameters = [{name: 'Parent', in: 'windowForm', location: 'parent'}];
  delete operation.prepareSelection.idsParameter;
  delete operation.prepareSelection.scopeFields;
  operation.prepareSelection.parentParameter = 'Parent';
  context.metadata.view = {content: {editableCollection: {operations: [operation]}}};
  selection.value = {selection: []};
  const reader = context.Context('read');
  reader.identity = {...context.identity, dataSourceRef: 'read', dataSourceId: context.identity.windowId + 'DSread'};
  reader.metadata = context.metadata;
  reader.authorization = context.authorization;
  reader.signals = {
    collection: {value: [{id: form.value.parent}]}, input: {value: {parameters: {Parent: form.value.parent}}},
    control: {value: {loaded: true}},
  };
  const resolve = context.Context;
  context.Context = ref => ref === 'read' ? reader : resolve(ref);
  f.calls.read = () => ({data: [{id: form.value.parent}]});
  const admit = () => recordParentRead(admitParentRead(reader, {Parent: form.value.parent}), reader.signals.collection.value);
  return {...f, reader, admit};
}

test('a bound parent reuses only an admitted current record and ignores unrelated child selection', async () => {
  for (const shape of [8, [8]]) {
    const f = parentFixture();
    f.form.value.parent = shape;
    f.reader.signals.input.value.parameters.Parent = shape;
    f.admit();
    f.selection.value = {selection: [{id: 91}]};
    assert.equal((await f.open()).status, 'opened');
    assert.deepEqual(f.events, ['prepare', 'seed', 'open']);
    assert.deepEqual(f.calls.args.parameters, {Parent: shape});
    assert.deepEqual(f.calls.form.ids, [8]);
  }
});

test('a cold parent reads exactly once with the declared argument shape', async () => {
  for (const change of [
    null, f => { f.reader.signals.control.value.stale = true; },
    f => { f.reader.signals.collection.value = [{id: 8}]; },
    f => { f.reader.authorization = {subject: 'other'}; f.context.authorization = f.reader.authorization; },
    f => { f.reader.metadata = {...f.reader.metadata}; },
    f => { f.reader.connector = {}; },
    f => { f.reader.identity.actorRef = 'other'; },
    f => { f.reader.signals.input.value.parameters = {Parent: 7}; },
    f => { f.reader.signals.input.value.filter = {group: 'different'}; },
    f => { f.form.value.parent = [8]; },
  ]) {
    const f = parentFixture();
    if (change) { f.admit(); change(f); }
    f.calls.read = () => ({data: [{id: 8}]});
    assert.equal((await f.open()).status, 'opened');
    assert.deepEqual(f.events, ['read', 'prepare', 'seed', 'open']);
    assert.deepEqual(f.calls.input, {Parent: f.form.value.parent});
  }
});

test('invalid or changed parent and revoked authorization cannot seed or open a draft', async () => {
  for (const invalid of [null, [], [8, 9], {}, true, '']) {
    const f = parentFixture();
    f.form.value.parent = invalid;
    assert.equal((await f.open()).status, 'failed');
    assert.deepEqual(f.events, []);
  }
  for (const replace of [f => { f.form.value.parent = 9; }, f => { f.context.authorization = {subject: 'other'}; }]) {
    const f = parentFixture();
    let finish;
    f.calls.read = () => new Promise(resolve => { finish = resolve; });
    const pending = f.open();
    replace(f);
    finish({data: [{id: 8}]});
    assert.equal((await pending).status, 'superseded');
    assert.deepEqual(f.events, ['read']);
  }
});

function draftBindingFixture() {
  const f = parentFixture();
  const limits = {value:[{remaining:2, owner:8, note:null, internal:'private'}]};
  const resolve = f.context.Context;
  f.context.Context = ref => ref === 'limits' ? {signals:{collection:limits}} : resolve(ref);
  const binding = (name, location) => ({name, from:'limits:collection', location, to:'draft:parameters'});
  f.operation.parameters.push(binding('remaining','0.remaining'), binding('owner','0.owner'),
    binding('note','0.note'), binding('absent','0.missing'));
  return {...f, limits};
}

test('a prepared parent binds only named live collection fields to the draft without disturbing a warm read', async () => {
  for (const warm of [true, false]) {
    const f = draftBindingFixture();
    if (warm) f.admit();
    assert.equal((await f.open()).status, 'opened');
    assert.deepEqual(f.calls.args.draftParameters, {remaining:2, owner:8, note:null});
    assert.deepEqual(f.calls.args.parameters, {Parent:8});
    assert.equal(f.events.filter(event => event === 'read').length, warm ? 0 : 1);
    if (!warm) assert.deepEqual(f.calls.input, {Parent:8});
    assert.equal(f.limits.value[0].internal, 'private');
  }
});

test('a replaced peer collection suppresses a draft without changing the parent identity', async () => {
  const f = draftBindingFixture();
  let finish;
  f.calls.read = () => new Promise(resolve => { finish = resolve; });
  const pending = f.open();
  f.limits.value = [{remaining:0, owner:9, note:null}];
  finish({data:[{id:8}]});
  assert.equal((await pending).status, 'superseded');
  assert.deepEqual(f.events, ['read']);
});

test('scoped reader and draft parameters with the same field name remain separate', async () => {
  const f = draftBindingFixture();
  f.operation.parameters[0] = {name:'Parent',from:'grid:windowform',location:'parent',to:'read:parameters'};
  f.operation.parameters.push({name:'Parent',from:'limits:collection',location:'0.remaining',to:'draft:parameters'},
    {name:'pageSize',in:'const',location:1}, {name:'language',in:'const',location:'en',to:'read'});
  assert.equal((await f.open()).status, 'opened');
  assert.deepEqual(f.calls.input, {Parent:8,pageSize:1,language:'en'});
  assert.equal(f.calls.args.draftParameters.Parent, 2);
});

test('foreign draft-binding destinations fail before reading or opening', async () => {
  for (const binding of [{to:'unrelated:parameters',from:'limits:collection'}, {kind:'unrelated',in:'const'},
    {to:'draft:parameters',in:'const'}]) {
    const f = draftBindingFixture();
    f.operation.parameters.push({name:'unexpected',location:'0.remaining',...binding});
    const result = await f.open();
    assert.equal(result.status, 'failed');
    assert.match(result.error.message, /destination/);
    assert.deepEqual(f.events, []);
  }
});
