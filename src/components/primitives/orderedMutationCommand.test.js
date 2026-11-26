import assert from 'node:assert/strict';
import test from 'node:test';
import {executeCommand, getCommandState, resolveIndeterminateCommand} from './commandExecutor.js';
import {getDialogSignal} from '../../core/store/signals.js';

const writer = (commandId, options) => ({commandId, dataSourceRef: commandId, ...options});
const stage = (id, options) => ({command: writer(id, options), cleanup: writer('undo_' + id)});
const ordered = (before, options) => writer('save', {before, serializationGroup: 'draft', ...options});

function fixture(handlers = {}) {
  const calls = [];
  const sources = new Map();
  const windowForm = {value: {ready: true}, peek() {return this.value;}};
  const context = {
    identity: {windowId: 'test'},
    signals: {windowForm},
    Context(ref) {
      if (!sources.has(ref)) {
        let input;
        sources.set(ref, {handlers: {dataSource: {
          setInputParameters(value) {input = value;},
          fetchCollection(options) {
            calls.push({ref, input, options});
            return Promise.resolve(handlers[ref] ? handlers[ref](options) : []);
          },
        }}});
      }
      return sources.get(ref);
    },
  };
  return {context, windowForm, calls};
}

test('omitted and empty before both accept an ordinary writer without rows', async () => {
  for (const options of [{}, {before: []}]) {
    const {context, calls} = fixture({save: () => undefined});
    const result = await executeCommand(context, writer('save', options), {base: 3});
    assert.equal(result.status, 'succeeded');
    assert.deepEqual(calls.map(call => call.input), [{base: 3}]);
    assert.equal(calls[0].options.result, undefined);
  }
});

test('steps expose only immutable invocation receipts and invoke each eligible writer once', async () => {
  const record = {id: 7};
  const {context, calls} = fixture({first: () => [record]});
  context.lookupHandler = () => ({extras}) => {
    record.id = 9;
    assert.equal(extras.steps.first.rows[0].id, 7);
    assert.ok(Object.isFrozen(extras.steps.first.rows[0]));
    assert.deepEqual(extras.steps.second.rows, []);
    return {firstId: extras.steps.first.rows[0].id};
  };
  const command = ordered([
    stage('first', {invocationParameter: 'RequestId'}), stage('second'),
    {...stage('skip'), when: {source: 'windowForm', field: 'skip', equals: true}},
  ], {prepare: 'finish', pendingState: {ready: false}, validateWhen: {source: 'windowForm', field: 'ready', equals: true}});
  const result = await executeCommand(context, command, {input: 1, steps: {fake: true}});
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(calls.map(call => call.ref), ['first', 'second', 'save']);
  assert.deepEqual(calls[0].input, {input: 1, RequestId: calls[0].options.invocationId});
  assert.deepEqual(calls[1].input, {input: 1});
  assert.deepEqual(calls[2].input, {firstId: 7});
  assert.equal(new Set(calls.map(call => call.options.invocationId)).size, 3);
});

test('definitive refusal compensates in reverse and preserves both causes', async () => {
  const primary = Object.assign(new Error('write conflict'), {status: 409});
  const secondary = new Error('cleanup denied');
  const {context, calls} = fixture({save: () => {throw primary;}, undo_b: () => {throw secondary;}});
  const command = ordered([stage('a'), stage('b')]);
  const result = await executeCommand(context, command);
  assert.deepEqual(calls.map(call => call.ref), ['a', 'b', 'save', 'undo_b', 'undo_a']);
  assert.equal(result.error, primary);
  assert.equal(result.warnings[0].error, secondary);
  assert.equal(result.warnings[0].commandId, 'undo_b');
  assert.equal(getCommandState(context, command).guarded, false);
});

test('unknown step preserves the group and the exact datasource lease until resolution', async () => {
  for (const unknown of [() => undefined, () => {throw Object.assign(new Error('request timed out'), {status: 408});}]) {
    const handlers = {b: unknown};
    const {context, calls} = fixture(handlers);
    const command = ordered([stage('a'), stage('b')]);
    const result = await executeCommand(context, command);
    assert.equal(result.status, 'indeterminate');
    assert.equal(result.failedStepId, 'b');
    assert.equal(result.accepted, true);
    assert.equal(getCommandState(context, command).writerStatus, 'not_invoked');
    assert.deepEqual(calls.map(call => call.ref), ['a', 'b']);
    assert.equal((await executeCommand(context, ordered([], {commandId: 'other'}))).status, 'group_busy');
    assert.equal((await executeCommand(context, writer('other', {dataSourceRef: 'b'}))).status, 'transport_busy');
    assert.ok(resolveIndeterminateCommand(context, command));
    handlers.b = () => [];
    assert.equal((await executeCommand(context, writer('other', {dataSourceRef: 'b'}))).status, 'succeeded');
  }
});

test('changed eligibility during asynchronous prepare prevents the final write', async () => {
  const {context, calls, windowForm} = fixture();
  context.lookupHandler = () => async () => {
    windowForm.value = {...windowForm.value, capacity: false};
    return {};
  };
  windowForm.value.capacity = true;
  const command = ordered([stage('a')], {prepare: 'prepare', validateWhen: {source: 'windowForm', field: 'capacity', equals: true}});
  assert.equal((await executeCommand(context, command)).status, 'invalid');
  assert.deepEqual(calls.map(call => call.ref), ['a', 'undo_a']);
});

test('root confirmation cancellation and unavailable confirmation run no writers', async () => {
  const {context, calls} = fixture();
  const command = ordered([stage('a')], {confirm: 'Save?'});
  assert.equal((await executeCommand(context, command)).status, 'confirmation_unavailable');
  assert.equal((await executeCommand(context, command, {}, {confirm: async () => false})).status, 'cancelled');
  assert.deepEqual(calls, []);
});

test('a known save stays successful when the original dialog is replaced during dispatch', async () => {
  const dialog = getDialogSignal('testDialogeditor');
  dialog.value = {open: true, props: {record: 4}};
  const {context, calls, windowForm} = fixture({save: () => {
    dialog.value = {open: true, props: {record: 9}};
    return [{id: 7}];
  }});
  const command = ordered([stage('a')], {successState: {saved: true}, refresh: [{dataSourceRef: 'list'}]});
  const result = await executeCommand(context, command, {}, {dialogId: 'editor'});
  assert.equal(result.status, 'succeeded');
  assert.equal(result.warnings.length, 1);
  assert.equal(windowForm.value.saved, undefined);
  assert.deepEqual(calls.map(call => call.ref), ['a', 'save']);
});

test('failed snapshot releases serialization before a new attempt', async () => {
  const {context} = fixture();
  const command = ordered([stage('a')]);
  assert.equal((await executeCommand(context, command, {uncloneable() {}})).status, 'failed');
  assert.equal((await executeCommand(context, command)).status, 'succeeded');
});

test('cleanup receipt predicate checks only its invocation and preserves the original failure', async () => {
  const receiptWhen = {any: [
    {source: 'collection', field: '0.removed', equals: true},
    {source: 'collection', field: '0.data.removed', equals: true},
  ]};
  for (const [rows, acknowledged] of [
    [[{removed: true}], true], [[{data: {removed: true}}], true], [[{removed: false}], false],
    [[{}], false], [[], false], [[{removed: 'true'}], false],
  ]) {
    const conflict = Object.assign(new Error('save conflicted'), {status: 409});
    const {context, calls} = fixture({save: () => {throw conflict;}, undo_b: () => rows});
    context.Context('undo_b').signals = {collection: {peek: () => [{removed: true}]}};
    const second = stage('b');
    second.cleanup.receiptWhen = receiptWhen;
    const command = ordered([stage('a'), second]);
    const result = await executeCommand(context, command);
    assert.equal(result.status, 'failed');
    assert.equal(result.error, conflict);
    assert.deepEqual(result.warnings.map(w => w.commandId), acknowledged ? [] : ['undo_b']);
    assert.deepEqual(calls.map(c => c.ref), ['a', 'b', 'save', 'undo_b', 'undo_a']);
  }
});

test('an invalid receipt scope is rejected before any side effect', async () => {
  for (const rule of [
    {source: 'windowForm', field: 'ready', equals: true},
    {source: 'collection', dataSourceRef: 'other', field: '0.removed', equals: true},
    {any: []},
  ]) {
    const {context, calls} = fixture();
    const entry = stage('a');
    entry.cleanup.receiptWhen = rule;
    assert.equal((await executeCommand(context, ordered([entry]))).accepted, false);
    assert.deepEqual(calls, []);
  }
});

test('clearFormFields acts on unchanged submitted fields only, with or without preparation steps', async () => {
  for (const before of [undefined, [], [stage('a')]]) {
    for (const ending of ['success', 'failed', 'unknown', 'reopened', 'cancelled', 'invalid']) {
      const submitted = {name: 'original'}, replacement = {name: 'newer'};
      const form = {file: submitted, files: [submitted], replaced: submitted, kept: 1};
      const dialog = getDialogSignal('testDialogclear');
      dialog.value = {open: true, props: {owner: 1}};
      const handlers = {save: () => {
        signal.value = {...signal.value, replaced: replacement, kept: 2};
        if (ending === 'reopened') dialog.value = {open: true, props: {owner: 2}};
        if (ending === 'failed') throw Object.assign(new Error('rejected'), {status: 422});
        return ending === 'unknown' ? undefined : [];
      }};
      const {context, calls} = fixture(handlers);
      const signal = {value: form, peek() {return this.value;}};
      context.signals.form = signal;
      let updates = 0;
      context.handlers = {dataSource: {setEditedFormData({values}) {signal.value = values; updates++;}}};
      const command = writer('save', {before, clearFormFields: ['file', 'files', 'replaced', 'unset'],
        ...(ending === 'cancelled' ? {confirm: 'Save?'} : {}),
        ...(ending === 'invalid' ? {validateWhen: {source: 'windowForm', field: 'ready', equals: false}} : {})});
      const result = await executeCommand(context, command, {}, {dialogId: 'clear', confirm: async () => false});
      const cleared = ['success', 'failed'].includes(ending);
      assert.equal(updates, cleared ? 1 : 0);
      assert.equal(signal.value.file, cleared ? null : submitted);
      assert.deepEqual(signal.value.files, cleared ? [] : [submitted]);
      assert.equal('unset' in signal.value, false);
      if (['cancelled', 'invalid'].includes(ending)) assert.deepEqual(calls, []);
      else {
        assert.equal(signal.value.replaced, replacement);
        assert.equal(signal.value.kept, 2);
      }
      if (ending === 'unknown') assert.equal(result.status, 'indeterminate');
    }
  }
});

test('pre-dispatch refusal retains submitted fields', async () => {
  const {context} = fixture();
  context.signals.form = {peek: () => ({file: 'submitted'})};
  let edits = 0;
  context.handlers = {dataSource: {setEditedFormData() {edits++;}}};
  context.Context('save').handlers.dataSource.fetchCollection = () => false;
  const result = await executeCommand(context, writer('save', {clearFormFields: ['file']}));
  assert.equal(result.accepted, false);
  assert.equal(edits, 0);
});

test('a close observer can recheck its scope after awaiting a dismissal hook', async () => {
  const {context, calls} = fixture();
  const dialog = getDialogSignal('testDialogeditor');
  dialog.value = {open: true, props: {id: 1}};
  let entered, resume;
  const waiting = new Promise(resolve => {entered = resolve;});
  const gate = new Promise(resolve => {resume = resolve;});
  let closed = false;
  const pending = executeCommand(context, writer('save'), {}, {dialogId: 'editor',
    closeOnSuccess: async current => {
      entered();
      await gate;
      if (current()) closed = true;
    }});
  await waiting;
  dialog.value = {open: true, props: {id: 1}};
  resume();
  assert.equal((await pending).status, 'succeeded');
  assert.equal(closed, false);
  assert.equal(calls.length, 1);
});

test('root and preparation receipts distinguish a confirmed write, rejection and unknown outcome', async () => {
  const condition = (field, equals) => ({source: 'collection', field, equals});
  const options = {receiptWhen: condition('0.accepted', true), rejectedWhen: condition('0.rejected', true)};
  for (const position of ['single', 'root', 'step']) {
    for (const [rows, status] of [
      [[{accepted: true, rejected: false}], 'succeeded'],
      [[{accepted: true, rejected: true, message: 'Rejected by producer'}], 'failed'],
      [[{accepted: false, rejected: false}], 'indeterminate'],
      [[{accepted: true}], 'indeterminate'],
      [[], 'indeterminate'],
      [[false], 'indeterminate'],
    ]) {
      const checked = position === 'step' ? 'verify' : 'save';
      const {context, calls, windowForm} = fixture({[checked]: () => rows});
      context.Context(checked).signals = {collection: {value: [{accepted: true, rejected: false}]}};
      const before = position === 'single' ? [] : [stage('first')];
      if (position === 'step') before.push(stage(checked, options));
      const command = ordered(before, {
        ...(position === 'step' ? {} : options), successState: {saved: true},
        refresh: [{dataSourceRef: 'refresh'}],
      });
      const result = await executeCommand(context, command);
      assert.equal(result.status, status, position);
      assert.equal(windowForm.value.saved, status === 'succeeded' ? true : undefined);
      assert.equal(calls.some(c => c.ref === 'refresh'), status === 'succeeded');
      assert.equal(calls.find(c => c.ref === checked).options.result, 'orderedRecords');
      assert.equal(calls.some(c => c.ref === 'undo_first'), status === 'failed' && position !== 'single');
      if (position === 'step') assert.equal(calls.some(c => c.ref === 'save'), status === 'succeeded');
      if (status === 'failed') assert.equal(result.error.message, 'Rejected by producer');
      if (status === 'indeterminate') {
        assert.equal(getCommandState(context, command).retryAllowed, false);
        assert.equal((await executeCommand(context, command)).status, 'suppressed');
      }
    }
  }
});

test('a missing receipt field cannot become proof through negation, while an explicit null is present', async () => {
  const missing = {source: 'collection', field: '0.other', notEquals: 'no'};
  const present = {source: 'collection', field: '0.flag', equals: null};
  for (const [rule, status] of [[missing, 'indeterminate'], [{not: missing}, 'indeterminate'],
      [{all: [missing, present]}, 'indeterminate'], [{any: [missing, present]}, 'succeeded'], [present, 'succeeded']]) {
    const {context} = fixture({save: () => [{flag: null}]});
    assert.equal((await executeCommand(context, writer('save', {receiptWhen: rule}))).status, status);
  }
});

test('writer numeric bounds require a finite JSON number in the receipt', async () => {
  const atLeastZero = {source: 'collection', field: '0.count', gte: 0};
  for (const [count, expected] of [[0, 'succeeded'], [2, 'succeeded'], [null, 'indeterminate'], ['2', 'indeterminate'], [false, 'indeterminate']]) {
    const {context} = fixture({save: () => [{count}]});
    assert.equal((await executeCommand(context, writer('save', {receiptWhen: atLeastZero}))).status, expected);
    if (expected === 'indeterminate') {
      const other = fixture({save: () => [{count}]});
      assert.equal((await executeCommand(other.context, writer('save', {receiptWhen: {not: atLeastZero}}))).status, expected);
    }
  }
});

test('invalid receipt predicates fail before writing', async () => {
  const scoped = {source: 'collection', field: '0.success', equals: true};
  for (const command of [
    writer('save', {rejectedWhen: scoped}),
    ordered([stage('a', {rejectedWhen: scoped})]),
    ordered([{command: writer('a'), cleanup: writer('undo', {receiptWhen: scoped, rejectedWhen: scoped})}]),
    writer('save', {receiptWhen: {source: 'form', field: '0.success', equals: true}}),
    writer('save', {receiptWhen: {source: 'collection', field: '0.success', unsupported: true}}),
    writer('save', {receiptWhen: {source: 'collection', field: '0.success', equals: true, exists: true}}),
  ]) {
    const {context, calls} = fixture();
    assert.equal((await executeCommand(context, command)).accepted, false);
    assert.deepEqual(calls, []);
  }
});

test('confirmed receipt from a replaced footer skips form, window and owner refresh effects', async () => {
  const dialog = getDialogSignal('testDialogqualified');
  dialog.value = {open: true, props: {record: 1}};
  const {context, calls, windowForm} = fixture({save: () => {
    dialog.value = {open: true, props: {record: 2}};
    return [{accepted: true}];
  }});
  context.signals.form = {value: {done: false}, peek() {return this.value;}};
  context.handlers = {dataSource: {setEditedFormData: ({values}) => {context.signals.form.value = values;}}};
  const command = writer('save', {
    receiptWhen: {source: 'collection', field: '0.accepted', equals: true},
    successFormState: {done: true}, successState: {saved: true}, refresh: [{dataSourceRef: 'owner'}],
  });
  try {
    const result = await executeCommand(context, command, {}, {dialogId: 'qualified'});
    assert.equal(result.status, 'succeeded');
    assert.equal(context.signals.form.value.done, false);
    assert.equal(windowForm.value.saved, undefined);
    assert.deepEqual(calls.map(call => call.ref), ['save']);
  } finally {dialog.value = {open: false};}
});

test('matching submitted identities uses final parameters and the exact invocation rows', async () => {
  const receiptIdentity = {field: 'key', submittedRows: 'body.items', submittedField: 'entity.key'};
  for (const [ids, expected] of [
    [[8, 7], 'succeeded'], [[7], 'indeterminate'], [[7, 7], 'indeterminate'],
    [[7, 99], 'indeterminate'], [[7, 8, 9], 'indeterminate'], [['7', 8], 'indeterminate'],
    [[null, 8], 'indeterminate'], [[true, 8], 'indeterminate'], [[], 'indeterminate'],
  ]) {
    for (const preparation of [false, true]) {
      const ref = preparation ? 'stage' : 'save';
      const {context, calls} = fixture({[ref]: () => ids.map(key => ({key}))});
      context.lookupHandler = () => () => ({body: {items: [{entity: {key: 7}}, {entity: {key: 8}}]}});
      const checked = writer(ref, {receiptIdentity, prepare: 'resolve', successState: preparation ? undefined : {saved: true}});
      const command = preparation ? ordered([{command: checked}]) : checked;
      const result = await executeCommand(context, command, {body: {items: [{entity: {key: 99}}]}});
      assert.equal(result.status, expected);
      assert.equal(calls.length, preparation && expected === 'succeeded' ? 2 : 1);
      assert.equal(context.signals.windowForm.value.saved, !preparation && expected === 'succeeded' ? true : undefined);
    }
  }
});

test('invalid submitted identities are rejected before transport; generated receipt requires one identity', async () => {
  for (const values of [[], [true], [null], [' '], [2.5], [2 ** 53], [1, 1]]) {
    const {context, calls} = fixture();
    await executeCommand(context, writer('save', {receiptIdentity: {field: 'id', submittedRows: 'items'}}), {items: values.map(id => ({id}))});
    assert.equal(calls.length, 0);
  }
  for (const [rows, expected] of [[[{key: 'created'}], 'succeeded'], [[{key: 27}], 'succeeded'],
    [[{key: 0}], 'succeeded'], [[{key: null}], 'indeterminate'], [[{}, {key: 1}], 'indeterminate'], [[], 'indeterminate']]) {
    const {context} = fixture({save: () => rows});
    assert.equal((await executeCommand(context, writer('save', {receiptIdentity: {generated: true, field: 'key'}}))).status, expected);
  }
  const {context} = fixture({save: () => [{rejected: true}]});
  const command = writer('save', {receiptIdentity: {generated: true, field: 'key'}, rejectedWhen: {source:'collection',field:'0.rejected',equals:true}});
  assert.equal((await executeCommand(context, command)).status, 'failed');
});

test('a transport cannot replace the submitted identity set while it owns the request', async () => {
  const {context, calls} = fixture({save: () => {
    calls[0].input.items[0].key = 'replacement';
    return [{key: 'replacement'}];
  }});
  const result = await executeCommand(context, writer('save', {receiptIdentity: {submittedRows:'items', field:'key'}}),
    {items:[{key:'original'}]});
  assert.equal(result.status, 'indeterminate');
  assert.equal(calls.length, 1);
});

test('a generated invocation parameter cannot replace a verified row collection', async () => {
  const {context, calls} = fixture({save: () => [{id: 1}]});
  const command = writer('save', {invocationParameter: 'items', receiptIdentity: {field: 'id', submittedRows: 'items'}});
  const outcome = await executeCommand(context, command, {items: [{id: 1}]});
  assert.notEqual(outcome.status, 'succeeded');
  assert.equal(calls.length, 0);
});
