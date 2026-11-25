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
